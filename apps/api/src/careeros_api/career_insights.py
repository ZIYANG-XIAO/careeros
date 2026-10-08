"""Count-only personal insights over facts the user already owns.

Post-V1 "Personal insights" phase (see docs/ROADMAP.md): these endpoints only
count and list existing records. They never score, predict outcomes, or infer
new professional claims; every number traces back to a stored analysis.
"""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import (
    Application,
    EvidenceMatch,
    IntelligenceClassification,
    JobAnalysis,
    ResumeDraftItemStatus,
    ResumeImport,
    ResumeImportStatus,
    ResumeVersion,
    SavedJob,
    User,
)

router = APIRouter(prefix="/insights", tags=["insights"])

MAX_REQUIREMENTS = 12

GapClassification = Literal["HIDDEN_EVIDENCE", "WEAK_EVIDENCE", "GENUINE_GAP"]
_GAP_CLASSIFICATIONS: frozenset[str] = frozenset(
    {
        IntelligenceClassification.HIDDEN_EVIDENCE.value,
        IntelligenceClassification.WEAK_EVIDENCE.value,
        IntelligenceClassification.GENUINE_GAP.value,
    }
)
_CLOSED_STATUSES = ("REJECTED", "WITHDRAWN")


class RequirementGapJob(BaseModel):
    job_id: UUID
    company: str
    title: str
    classification: GapClassification


class RequirementGap(BaseModel):
    label: str
    category: str
    job_count: int
    genuine_gap_count: int
    weak_evidence_count: int
    hidden_evidence_count: int
    jobs: list[RequirementGapJob]


class RequirementGapsResponse(BaseModel):
    tracked_job_count: int
    analyzed_job_count: int
    requirements: list[RequirementGap]


def _requirement_key(normalized_value: str | None, description: str) -> str:
    return " ".join((normalized_value or description).lower().split())


@router.get("/requirement-gaps", response_model=RequirementGapsResponse)
async def requirement_gaps(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> RequirementGapsResponse:
    """Requirements that recur across the jobs the user is pursuing but lack
    strong, visible evidence, grouped by the requirement's normalized value.

    "Pursuing" means saved, or linked to an open application. Only the latest
    analysis of each job counts, so re-running an analysis never double-counts.
    """
    saved_ids = select(SavedJob.job_id).where(SavedJob.user_id == user.id)
    applied_ids = select(Application.job_id).where(
        Application.user_id == user.id,
        Application.job_id.is_not(None),
        Application.status.not_in(_CLOSED_STATUSES),
    )
    tracked_job_ids = set((await session.execute(saved_ids.union(applied_ids))).scalars().all())
    tracked_job_ids.discard(None)
    if not tracked_job_ids:
        return RequirementGapsResponse(tracked_job_count=0, analyzed_job_count=0, requirements=[])

    latest_versions = (
        select(JobAnalysis.job_id, func.max(JobAnalysis.analysis_version).label("version"))
        .where(JobAnalysis.user_id == user.id, JobAnalysis.job_id.in_(tracked_job_ids))
        .group_by(JobAnalysis.job_id)
        .subquery()
    )
    analyses = (
        (
            await session.execute(
                select(JobAnalysis)
                .join(
                    latest_versions,
                    (JobAnalysis.job_id == latest_versions.c.job_id)
                    & (JobAnalysis.analysis_version == latest_versions.c.version),
                )
                .where(JobAnalysis.user_id == user.id)
                .options(
                    selectinload(JobAnalysis.job),
                    selectinload(JobAnalysis.matches).selectinload(EvidenceMatch.job_requirement),
                )
            )
        )
        .scalars()
        .all()
    )

    grouped: dict[str, RequirementGap] = {}
    for analysis in analyses:
        seen_in_job: set[str] = set()
        for match in sorted(analysis.matches, key=lambda item: item.job_requirement.position):
            if match.classification not in _GAP_CLASSIFICATIONS:
                continue
            requirement = match.job_requirement
            key = _requirement_key(requirement.normalized_value, requirement.description)
            if not key or key in seen_in_job:
                continue
            seen_in_job.add(key)
            gap = grouped.setdefault(
                key,
                RequirementGap(
                    label=(requirement.normalized_value or requirement.description).strip(),
                    category=requirement.category,
                    job_count=0,
                    genuine_gap_count=0,
                    weak_evidence_count=0,
                    hidden_evidence_count=0,
                    jobs=[],
                ),
            )
            gap.job_count += 1
            if match.classification == IntelligenceClassification.GENUINE_GAP.value:
                gap.genuine_gap_count += 1
            elif match.classification == IntelligenceClassification.WEAK_EVIDENCE.value:
                gap.weak_evidence_count += 1
            else:
                gap.hidden_evidence_count += 1
            gap.jobs.append(
                RequirementGapJob(
                    job_id=analysis.job_id,
                    company=analysis.job.company,
                    title=analysis.job.title,
                    classification=match.classification,  # type: ignore[arg-type]
                )
            )

    requirements = sorted(grouped.values(), key=lambda gap: (-gap.job_count, gap.label.lower()))
    return RequirementGapsResponse(
        tracked_job_count=len(tracked_job_ids),
        analyzed_job_count=len(analyses),
        requirements=requirements[:MAX_REQUIREMENTS],
    )


class PendingResumeImport(BaseModel):
    id: UUID
    filename: str
    pending_item_count: int
    created_at: datetime


@router.get("/pending-resume-imports", response_model=list[PendingResumeImport])
async def pending_resume_imports(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[PendingResumeImport]:
    """Resume imports whose extracted items still await the user's review.

    Imported items stay UNCONFIRMED drafts until the user confirms them, so
    this is the profile's real "waiting for you" queue.
    """
    imports = (
        (
            await session.execute(
                select(ResumeImport)
                .where(
                    ResumeImport.user_id == user.id,
                    ResumeImport.status == ResumeImportStatus.READY_FOR_REVIEW.value,
                )
                .options(
                    selectinload(ResumeImport.version).selectinload(ResumeVersion.asset),
                    selectinload(ResumeImport.items),
                )
                .order_by(ResumeImport.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    return [
        PendingResumeImport(
            id=resume_import.id,
            filename=resume_import.version.asset.original_filename,
            pending_item_count=sum(
                1
                for item in resume_import.items
                if item.status == ResumeDraftItemStatus.ACTIVE.value
            ),
            created_at=resume_import.created_at,
        )
        for resume_import in imports
    ]
