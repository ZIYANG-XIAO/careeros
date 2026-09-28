"""Grounded, reproducible Job Intelligence analysis endpoints."""

from datetime import datetime
from typing import Annotated
from uuid import UUID

import sqlalchemy as sa
from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload, selectinload
from sqlalchemy.sql.base import ExecutableOption

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.job_intelligence_schemas import (
    EvidenceInput,
    MatchEvaluation,
    MatchEvaluationBatch,
    RequirementInput,
    classify_match,
    validate_match_evaluations,
)
from careeros_api.job_matcher import MATCHER_VERSION, JobMatcher, JobMatchingError, get_job_matcher
from careeros_api.models import (
    ApplicationRecommendation,
    CareerBrain,
    CareerEvidence,
    CareerEvidenceRevision,
    ConfirmationStatus,
    EvidenceMatch,
    EvidenceMatchReference,
    EvidenceSupportStrength,
    IntelligenceClassification,
    Job,
    JobAnalysis,
    JobRequirement,
    JobSnapshot,
    Resume,
    ResumeVersion,
    User,
)
from careeros_api.rate_limit import ai_rate_limit

router = APIRouter(prefix="/jobs/{job_id}/analyses", tags=["job-intelligence"])


class CreateJobAnalysisRequest(BaseModel):
    resume_version_id: UUID


class EvidenceReferenceResponse(BaseModel):
    career_evidence_id: UUID
    career_evidence_revision_id: UUID
    source_type: str
    source_id: UUID
    evidence_content: str
    revision_number: int


class RequirementAnalysisResponse(BaseModel):
    id: UUID
    requirement_id: UUID
    category: str
    description: str
    normalized_value: str | None
    importance: str
    source_text: str
    support_strength: str
    resume_representation: str
    classification: str
    explanation: str
    resume_source_text: str | None
    evidence_references: list[EvidenceReferenceResponse]


class JobAnalysisResponse(BaseModel):
    id: UUID
    job_id: UUID
    job_snapshot_id: UUID
    company: str
    title: str
    resume_version_id: UUID
    resume_name: str
    resume_version_number: int
    analysis_version: int
    matcher_version: str
    matcher_model: str
    overall_recommendation: str
    summary: str
    created_at: datetime
    matches: list[RequirementAnalysisResponse]


def job_matcher_dependency() -> JobMatcher:
    try:
        return get_job_matcher()
    except JobMatchingError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error


def _analysis_options() -> tuple[ExecutableOption, ...]:
    return (
        joinedload(JobAnalysis.job),
        joinedload(JobAnalysis.resume_version).joinedload(ResumeVersion.resume),
        selectinload(JobAnalysis.matches).joinedload(EvidenceMatch.job_requirement),
        selectinload(JobAnalysis.matches).selectinload(EvidenceMatch.evidence_references),
    )


def _analysis_response(analysis: JobAnalysis) -> JobAnalysisResponse:
    matches = sorted(analysis.matches, key=lambda item: item.job_requirement.position)
    return JobAnalysisResponse(
        id=analysis.id,
        job_id=analysis.job_id,
        job_snapshot_id=analysis.job_snapshot_id,
        company=analysis.job.company,
        title=analysis.job.title,
        resume_version_id=analysis.resume_version_id,
        resume_name=analysis.resume_version.resume.name,
        resume_version_number=analysis.resume_version.version_number,
        analysis_version=analysis.analysis_version,
        matcher_version=analysis.matcher_version,
        matcher_model=analysis.matcher_model,
        overall_recommendation=analysis.overall_recommendation,
        summary=analysis.summary,
        created_at=analysis.created_at,
        matches=[
            RequirementAnalysisResponse(
                id=match.id,
                requirement_id=match.job_requirement_id,
                category=match.job_requirement.category,
                description=match.job_requirement.description,
                normalized_value=match.job_requirement.normalized_value,
                importance=match.job_requirement.importance,
                source_text=match.job_requirement.source_text,
                support_strength=match.support_strength,
                resume_representation=match.resume_representation,
                classification=match.classification,
                explanation=match.explanation,
                resume_source_text=match.resume_source_text,
                evidence_references=[
                    EvidenceReferenceResponse(
                        career_evidence_id=reference.career_evidence_id,
                        career_evidence_revision_id=reference.career_evidence_revision_id,
                        source_type=reference.source_type,
                        source_id=reference.source_id,
                        evidence_content=reference.evidence_content,
                        revision_number=reference.revision_number,
                    )
                    for reference in sorted(
                        match.evidence_references,
                        key=lambda item: (item.source_type, str(item.source_id)),
                    )
                ],
            )
            for match in matches
        ],
    )


def _recommendation(
    requirements: list[JobRequirement],
    evaluations: dict[UUID, MatchEvaluation],
) -> tuple[ApplicationRecommendation, str]:
    typed = [evaluations[item.id] for item in requirements]
    required = [
        evaluations[item.id] for item in requirements if item.importance == "REQUIRED"
    ] or typed
    strengths = [item.support_strength for item in required]
    if strengths and all(item == EvidenceSupportStrength.STRONG for item in strengths):
        recommendation = ApplicationRecommendation.STRONG_APPLY
    elif all(item != EvidenceSupportStrength.NONE_OR_INSUFFICIENT for item in strengths):
        recommendation = ApplicationRecommendation.APPLY
    elif any(item != EvidenceSupportStrength.NONE_OR_INSUFFICIENT for item in strengths):
        recommendation = ApplicationRecommendation.STRETCH
    else:
        recommendation = ApplicationRecommendation.LOW_PRIORITY

    classifications = [
        classify_match(item.support_strength, item.resume_representation) for item in typed
    ]
    counts = {
        classification: classifications.count(classification)
        for classification in IntelligenceClassification
    }
    summary = (
        f"{counts[IntelligenceClassification.STRONG_EVIDENCE]} strong, "
        f"{counts[IntelligenceClassification.HIDDEN_EVIDENCE]} hidden, "
        f"{counts[IntelligenceClassification.WEAK_EVIDENCE]} weak, and "
        f"{counts[IntelligenceClassification.GENUINE_GAP]} genuine gap requirements."
    )
    return recommendation, summary


async def _load_analysis(
    session: AsyncSession, analysis_id: UUID, job_id: UUID, user_id: UUID
) -> JobAnalysis | None:
    return await session.scalar(
        select(JobAnalysis)
        .options(*_analysis_options())
        .where(
            JobAnalysis.id == analysis_id,
            JobAnalysis.job_id == job_id,
            JobAnalysis.user_id == user_id,
        )
    )


@router.post(
    "",
    response_model=JobAnalysisResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(ai_rate_limit)],
)
async def create_job_analysis(
    job_id: UUID,
    body: CreateJobAnalysisRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    matcher: Annotated[JobMatcher, Depends(job_matcher_dependency)],
) -> JobAnalysisResponse:
    job = await session.scalar(
        select(Job)
        .options(selectinload(Job.snapshots).selectinload(JobSnapshot.requirements))
        .where(Job.id == job_id, or_(Job.user_id == user.id, Job.user_id.is_(None)))
    )
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    if max(job.snapshots, key=lambda item: item.version_number).requirements_status != "PARSED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "REQUIREMENTS_PENDING",
                "message": "Extract this job's requirements before analyzing it",
            },
        )
    resume_version = await session.scalar(
        select(ResumeVersion)
        .options(joinedload(ResumeVersion.resume))
        .join(Resume, ResumeVersion.resume_id == Resume.id)
        .where(ResumeVersion.id == body.resume_version_id, Resume.user_id == user.id)
    )
    if resume_version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found"
        )
    brain = await session.scalar(select(CareerBrain).where(CareerBrain.user_id == user.id))
    if brain is None:  # pragma: no cover - identity provisioning invariant
        raise RuntimeError("Career Brain not found")
    snapshot = max(job.snapshots, key=lambda item: item.version_number)
    requirements = sorted(snapshot.requirements, key=lambda item: item.position)
    requirement_inputs = [
        RequirementInput(
            id=item.id,
            category=item.category,
            description=item.description,
            normalized_value=item.normalized_value,
            importance=item.importance,
        )
        for item in requirements
    ]
    evidence_rows = (
        await session.execute(
            select(CareerEvidence, CareerEvidenceRevision)
            .join(
                CareerEvidenceRevision,
                CareerEvidence.current_revision_id == CareerEvidenceRevision.id,
            )
            .where(
                CareerEvidence.career_brain_id == brain.id,
                CareerEvidenceRevision.confirmation_status == ConfirmationStatus.CONFIRMED.value,
            )
            .order_by(CareerEvidence.created_at)
        )
    ).all()
    evidence_inputs = [
        EvidenceInput(
            evidence_id=evidence.id,
            revision_id=revision.id,
            source_type=evidence.source_type,
            content=revision.content,
        )
        for evidence, revision in evidence_rows
    ]

    try:
        raw_batch = await matcher.analyze_job_requirements(
            requirement_inputs, evidence_inputs, resume_version.extracted_text
        )
        batch = MatchEvaluationBatch.model_validate(raw_batch)
        evaluations = validate_match_evaluations(
            batch, requirement_inputs, evidence_inputs, resume_version.extracted_text
        )
    except (JobMatchingError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "JOB_MATCHING_FAILED", "message": str(error)},
        ) from error

    await session.execute(select(Job).where(Job.id == job.id).with_for_update())
    current_version = await session.scalar(
        select(sa.func.max(JobAnalysis.analysis_version)).where(
            JobAnalysis.job_id == job.id, JobAnalysis.user_id == user.id
        )
    )
    recommendation, summary = _recommendation(requirements, evaluations)
    analysis = JobAnalysis(
        user_id=user.id,
        job_id=job.id,
        job_snapshot_id=snapshot.id,
        career_brain_id=brain.id,
        resume_version_id=resume_version.id,
        analysis_version=(current_version or 0) + 1,
        matcher_version=MATCHER_VERSION,
        matcher_model=str(getattr(matcher, "model", "deterministic-test-provider")),
        overall_recommendation=recommendation.value,
        summary=summary,
    )
    session.add(analysis)
    await session.flush()
    evidence_by_revision = {
        revision.id: (evidence, revision) for evidence, revision in evidence_rows
    }
    for requirement in requirements:
        evaluation = evaluations[requirement.id]
        match = EvidenceMatch(
            job_analysis_id=analysis.id,
            job_requirement_id=requirement.id,
            support_strength=evaluation.support_strength.value,
            resume_representation=evaluation.resume_representation.value,
            classification=classify_match(
                evaluation.support_strength, evaluation.resume_representation
            ).value,
            explanation=evaluation.explanation,
            resume_source_text=evaluation.resume_source_text,
        )
        session.add(match)
        await session.flush()
        for revision_id in evaluation.evidence_revision_ids:
            evidence, revision = evidence_by_revision[revision_id]
            session.add(
                EvidenceMatchReference(
                    evidence_match_id=match.id,
                    career_evidence_id=evidence.id,
                    career_evidence_revision_id=revision.id,
                    source_type=evidence.source_type,
                    source_id=evidence.source_id,
                    evidence_content=revision.content,
                    revision_number=revision.revision_number,
                )
            )
    await session.flush()
    loaded = await _load_analysis(session, analysis.id, job.id, user.id)
    if loaded is None:  # pragma: no cover - defensive invariant
        raise RuntimeError("Created analysis could not be loaded")
    return _analysis_response(loaded)


@router.get("", response_model=list[JobAnalysisResponse])
async def list_job_analyses(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[JobAnalysisResponse]:
    result = await session.execute(
        select(JobAnalysis)
        .options(*_analysis_options())
        .where(JobAnalysis.job_id == job_id, JobAnalysis.user_id == user.id)
        .order_by(JobAnalysis.analysis_version.desc())
    )
    return [_analysis_response(item) for item in result.scalars().all()]


@router.get("/{analysis_id}", response_model=JobAnalysisResponse)
async def get_job_analysis(
    job_id: UUID,
    analysis_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> JobAnalysisResponse:
    analysis = await _load_analysis(session, analysis_id, job_id, user.id)
    if analysis is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Analysis not found")
    return _analysis_response(analysis)
