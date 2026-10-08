"""Evidence-grounded application materials: tailoring, drafts, interview prep.

Owner-approved post-V1 (docs/ROADMAP.md Phase Z). Everything here is built
only from the user's confirmed Career Evidence and is validated server-side
(``materials_schemas``). Suggestions and drafts are proposals: nothing becomes
part of a resume until the user accepts specific edits, which creates a new
immutable Resume Version and never rewrites the base version.
"""

import asyncio
from hashlib import sha256
from io import BytesIO
from typing import Annotated, Literal
from uuid import UUID

from docx import Document
from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import joinedload

from careeros_api.answer_engine import classify_sensitive_question
from careeros_api.auth import get_current_user
from careeros_api.config import Settings, get_settings
from careeros_api.db import get_db_session
from careeros_api.job import _visible_job
from careeros_api.job_intelligence_schemas import EvidenceInput, RequirementInput
from careeros_api.materials_schemas import (
    PrepGap,
    PrepQuestion,
    PrepStory,
    apply_tailoring,
    valid_draft,
    valid_interview_prep,
    valid_tailoring_suggestions,
)
from careeros_api.materials_writer import (
    MATERIALS_WRITER_VERSION,
    MaterialsWriter,
    MaterialsWritingError,
    get_materials_writer,
)
from careeros_api.models import (
    CareerBrain,
    CareerEvidence,
    CareerEvidenceRevision,
    ConfirmationStatus,
    CreatedBy,
    Job,
    JobSnapshot,
    Resume,
    ResumeAsset,
    ResumeVersion,
    User,
)
from careeros_api.rate_limit import ai_rate_limit
from careeros_api.resume_storage import LocalResumeAssetStorage

router = APIRouter(tags=["materials"])

TAILORED_SOURCE = "TAILORED"
DOCX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document"


def materials_writer_dependency() -> MaterialsWriter:
    try:
        return get_materials_writer()
    except MaterialsWritingError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error


def _writing_failed(error: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
        detail={"code": "MATERIALS_FAILED", "message": str(error)},
    )


# ---------------------------------------------------------------------------
# Shared loading
# ---------------------------------------------------------------------------


async def _confirmed_evidence(session: AsyncSession, user: User) -> list[EvidenceInput]:
    brain = await session.scalar(select(CareerBrain).where(CareerBrain.user_id == user.id))
    if brain is None:  # pragma: no cover - identity provisioning invariant
        raise RuntimeError("Career Brain not found")
    rows = (
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
    return [
        EvidenceInput(
            evidence_id=evidence.id,
            revision_id=revision.id,
            source_type=evidence.source_type,
            content=revision.content,
        )
        for evidence, revision in rows
    ]


async def _job_with_requirements(
    session: AsyncSession, user: User, job_id: UUID
) -> tuple[Job, JobSnapshot, list[RequirementInput]]:
    job = await _visible_job(session, job_id, user.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    snapshot = max(job.snapshots, key=lambda item: item.version_number)
    if snapshot.requirements_status != "PARSED":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "REQUIREMENTS_PENDING",
                "message": "Extract this job's requirements first",
            },
        )
    requirements = [
        RequirementInput(
            id=item.id,
            category=item.category,
            description=item.description,
            normalized_value=item.normalized_value,
            importance=item.importance,
        )
        for item in sorted(snapshot.requirements, key=lambda item: item.position)
    ]
    return job, snapshot, requirements


async def _owned_version(session: AsyncSession, user: User, version_id: UUID) -> ResumeVersion:
    version = await session.scalar(
        select(ResumeVersion)
        .options(joinedload(ResumeVersion.resume), joinedload(ResumeVersion.asset))
        .join(Resume, ResumeVersion.resume_id == Resume.id)
        .where(ResumeVersion.id == version_id, Resume.user_id == user.id)
    )
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found"
        )
    return version


class CitedEvidence(BaseModel):
    revision_id: UUID
    content: str


def _cite(revision_ids: list[UUID], evidence: list[EvidenceInput]) -> list[CitedEvidence]:
    by_revision = {item.revision_id: item.content for item in evidence}
    return [
        CitedEvidence(revision_id=rid, content=by_revision[rid])
        for rid in revision_ids
        if rid in by_revision
    ]


class CitedRequirement(BaseModel):
    id: UUID
    description: str


def _requirements(ids: list[UUID], requirements: list[RequirementInput]) -> list[CitedRequirement]:
    by_id = {item.id: item.description for item in requirements}
    return [CitedRequirement(id=rid, description=by_id[rid]) for rid in ids if rid in by_id]


# ---------------------------------------------------------------------------
# Resume tailoring
# ---------------------------------------------------------------------------


class TailoringRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    resume_version_id: UUID


class TailoringSuggestionResponse(BaseModel):
    kind: Literal["REWRITE", "INSERT"]
    original_text: str | None
    insert_after: str | None
    suggested_text: str
    rationale: str
    requirements: list[CitedRequirement]
    evidence: list[CitedEvidence]


class TailoringResponse(BaseModel):
    base_resume_version_id: UUID
    suggestions: list[TailoringSuggestionResponse]
    dropped_count: int
    writer_version: str


@router.post(
    "/jobs/{job_id}/tailoring",
    response_model=TailoringResponse,
    dependencies=[Depends(ai_rate_limit)],
)
async def suggest_tailoring(
    job_id: UUID,
    body: TailoringRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    writer: Annotated[MaterialsWriter, Depends(materials_writer_dependency)],
) -> TailoringResponse:
    _, _, requirements = await _job_with_requirements(session, user, job_id)
    version = await _owned_version(session, user, body.resume_version_id)
    evidence = await _confirmed_evidence(session, user)
    try:
        batch = await writer.suggest_tailoring(requirements, evidence, version.extracted_text)
    except MaterialsWritingError as error:
        raise _writing_failed(error) from error
    kept = valid_tailoring_suggestions(batch, requirements, evidence, version.extracted_text)
    return TailoringResponse(
        base_resume_version_id=version.id,
        suggestions=[
            TailoringSuggestionResponse(
                kind=item.kind,
                original_text=item.original_text,
                insert_after=item.insert_after,
                suggested_text=item.suggested_text,
                rationale=item.rationale,
                requirements=_requirements(item.requirement_ids, requirements),
                evidence=_cite(item.evidence_revision_ids, evidence),
            )
            for item in kept
        ],
        dropped_count=len(batch.suggestions) - len(kept),
        writer_version=MATERIALS_WRITER_VERSION,
    )


class TailoredEdit(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["REWRITE", "INSERT"]
    original_text: str | None = Field(default=None, max_length=4000)
    insert_after: str | None = Field(default=None, max_length=4000)
    # The user's accepted (and possibly edited) wording; it is theirs.
    text: str = Field(min_length=1, max_length=1000)


class CreateTailoredVersionRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    base_resume_version_id: UUID
    job_id: UUID
    edits: list[TailoredEdit] = Field(min_length=1, max_length=30)


class TailoredVersionResponse(BaseModel):
    resume_id: UUID
    resume_version_id: UUID
    version_number: int
    original_filename: str


def _docx_bytes(text: str) -> bytes:
    document = Document()
    for line in text.splitlines():
        document.add_paragraph(line)
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


@router.post(
    "/resumes/tailored",
    response_model=TailoredVersionResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_tailored_version(
    body: CreateTailoredVersionRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> TailoredVersionResponse:
    """Apply the user's accepted edits as a new version of the same resume."""
    base = await _owned_version(session, user, body.base_resume_version_id)
    job = await _visible_job(session, body.job_id, user.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    try:
        text = apply_tailoring(
            base.extracted_text,
            [(edit.kind, edit.original_text, edit.insert_after, edit.text) for edit in body.edits],
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "EDIT_ANCHOR_MISSING", "message": str(error)},
        ) from error

    data = _docx_bytes(text)
    storage = LocalResumeAssetStorage(settings.resume_storage_dir)
    storage_key = await asyncio.to_thread(storage.save, data, ".docx")
    try:
        stem = base.asset.original_filename.rsplit(".", 1)[0][:200]
        company = "".join(ch for ch in job.company if ch.isalnum() or ch in " -_")[:80].strip()
        filename = f"{stem} - {company or 'tailored'}.docx"
        asset = ResumeAsset(
            user_id=user.id,
            storage_key=storage_key,
            original_filename=filename,
            content_type=DOCX_CONTENT_TYPE,
            size_bytes=len(data),
            sha256=sha256(data).hexdigest(),
        )
        session.add(asset)
        await session.flush()
        await session.execute(
            select(Resume.id).where(Resume.id == base.resume_id).with_for_update()
        )
        latest = await session.scalar(
            select(func.max(ResumeVersion.version_number)).where(
                ResumeVersion.resume_id == base.resume_id
            )
        )
        version = ResumeVersion(
            resume_id=base.resume_id,
            asset_id=asset.id,
            version_number=(latest or 0) + 1,
            source=TAILORED_SOURCE,
            created_by=CreatedBy.USER.value,
            source_version_id=base.id,
            extracted_text=text,
            # Same professional facts as the base; only wording changed.
            structured_content={**base.structured_content, "tailored_for_job_id": str(job.id)},
            parser_version=MATERIALS_WRITER_VERSION,
        )
        session.add(version)
        await session.flush()
    except Exception:
        await asyncio.to_thread(storage.delete, storage_key)
        raise
    return TailoredVersionResponse(
        resume_id=base.resume_id,
        resume_version_id=version.id,
        version_number=version.version_number,
        original_filename=filename,
    )


# ---------------------------------------------------------------------------
# Drafts
# ---------------------------------------------------------------------------


class DraftRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["COVER_LETTER", "OPEN_QUESTION"]
    job_id: UUID | None = None
    question: str | None = Field(default=None, max_length=2000)


class DraftResponse(BaseModel):
    kind: Literal["COVER_LETTER", "OPEN_QUESTION"]
    text: str
    evidence: list[CitedEvidence]
    unsupported_points: list[str]
    writer_version: str


@router.post("/drafts", response_model=DraftResponse, dependencies=[Depends(ai_rate_limit)])
async def create_draft(
    body: DraftRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    writer: Annotated[MaterialsWriter, Depends(materials_writer_dependency)],
) -> DraftResponse:
    if body.kind == "OPEN_QUESTION" and not (body.question and body.question.strip()):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "QUESTION_REQUIRED", "message": "Enter the question to answer"},
        )
    if body.question and classify_sensitive_question(body.question) is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "SENSITIVE_QUESTION",
                "message": "Sensitive questions are answered by you, never drafted",
            },
        )
    job_text = ""
    if body.job_id is not None:
        job = await _visible_job(session, body.job_id, user.id)
        if job is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
        job_text = max(job.snapshots, key=lambda item: item.version_number).raw_description
    elif body.kind == "COVER_LETTER":
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "JOB_REQUIRED", "message": "A cover letter needs a job"},
        )
    evidence = await _confirmed_evidence(session, user)
    if not evidence:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "NO_CONFIRMED_EVIDENCE",
                "message": "Confirm some experience first; drafts only use confirmed evidence",
            },
        )
    try:
        draft = await writer.draft_answer(body.kind, body.question, job_text, evidence)
    except MaterialsWritingError as error:
        raise _writing_failed(error) from error
    if not valid_draft(draft, evidence, body.question or "", job_text):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "DRAFT_NOT_GROUNDED",
                "message": "The draft could not be grounded in your confirmed evidence",
            },
        )
    return DraftResponse(
        kind=body.kind,
        text=draft.text,
        evidence=_cite(draft.evidence_revision_ids, evidence),
        unsupported_points=draft.unsupported_points,
        writer_version=MATERIALS_WRITER_VERSION,
    )


class CoverLetterFileRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    # The user's reviewed (possibly edited) letter; it is theirs.
    text: str = Field(min_length=1, max_length=8000)
    filename_hint: str | None = Field(default=None, max_length=120)


@router.post("/drafts/cover-letter-file")
async def cover_letter_file(
    body: CoverLetterFileRequest,
    user: Annotated[User, Depends(get_current_user)],
) -> Response:
    """Render a letter the user approved as a DOCX for an upload field.

    No AI call and nothing stored: the bytes go straight back to the caller.
    """
    del user  # Authentication only; the file is built from the request.
    stem = "".join(ch for ch in (body.filename_hint or "") if ch.isalnum() or ch in " -_")
    filename = f"{(stem.strip() or 'Cover letter')[:80]}.docx"
    return Response(
        content=_docx_bytes(body.text.strip()),
        media_type=DOCX_CONTENT_TYPE,
        headers={
            "Content-Disposition": f'attachment; filename="{filename}"',
            "Cache-Control": "no-store",
        },
    )


# ---------------------------------------------------------------------------
# Interview preparation
# ---------------------------------------------------------------------------


class PrepStoryResponse(BaseModel):
    prompt: str
    requirements: list[CitedRequirement]
    evidence: list[CitedEvidence]


class PrepQuestionResponse(BaseModel):
    question: str
    requirements: list[CitedRequirement]
    evidence: list[CitedEvidence]


class PrepGapResponse(BaseModel):
    requirement: CitedRequirement
    honest_framing: str


class InterviewPrepResponse(BaseModel):
    stories: list[PrepStoryResponse]
    questions: list[PrepQuestionResponse]
    gaps: list[PrepGapResponse]
    dropped_count: int
    writer_version: str


@router.post(
    "/jobs/{job_id}/interview-prep",
    response_model=InterviewPrepResponse,
    dependencies=[Depends(ai_rate_limit)],
)
async def interview_prep(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    writer: Annotated[MaterialsWriter, Depends(materials_writer_dependency)],
) -> InterviewPrepResponse:
    _, snapshot, requirements = await _job_with_requirements(session, user, job_id)
    evidence = await _confirmed_evidence(session, user)
    try:
        batch = await writer.prepare_interview(requirements, evidence, snapshot.raw_description)
    except MaterialsWritingError as error:
        raise _writing_failed(error) from error
    kept, dropped = valid_interview_prep(batch, requirements, evidence)

    def story(item: PrepStory) -> PrepStoryResponse:
        return PrepStoryResponse(
            prompt=item.prompt,
            requirements=_requirements(item.requirement_ids, requirements),
            evidence=_cite(item.evidence_revision_ids, evidence),
        )

    def question(item: PrepQuestion) -> PrepQuestionResponse:
        return PrepQuestionResponse(
            question=item.question,
            requirements=_requirements(item.requirement_ids, requirements),
            evidence=_cite(item.evidence_revision_ids, evidence),
        )

    def gap(item: PrepGap) -> PrepGapResponse:
        return PrepGapResponse(
            requirement=_requirements([item.requirement_id], requirements)[0],
            honest_framing=item.honest_framing,
        )

    return InterviewPrepResponse(
        stories=[story(item) for item in kept.stories],
        questions=[question(item) for item in kept.questions],
        gaps=[gap(item) for item in kept.gaps],
        dropped_count=dropped,
        writer_version=MATERIALS_WRITER_VERSION,
    )
