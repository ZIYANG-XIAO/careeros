"""Account-level data rights: export everything a user owns, or delete it all."""

import asyncio
import logging
from datetime import UTC, datetime
from typing import Annotated, Any, Literal

from fastapi import APIRouter, Depends, Response, status
from fastapi.encoders import jsonable_encoder
from fastapi.responses import JSONResponse
from pydantic import BaseModel, ConfigDict
from sqlalchemy import Select, delete, or_, select
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.auth import get_current_user
from careeros_api.config import Settings, get_settings
from careeros_api.db import get_db_session
from careeros_api.models import (
    Application,
    ApplicationActivity,
    ApplicationAnswer,
    ApplicationContact,
    ApplicationStatusHistory,
    Base,
    CareerBrain,
    CareerEvidence,
    CareerEvidenceRevision,
    Education,
    EvidenceMatch,
    Experience,
    ExperienceDetail,
    Job,
    JobAnalysis,
    JobPreferences,
    JobRequirement,
    JobSearchGoal,
    JobSnapshot,
    Project,
    ProjectDetail,
    Resume,
    ResumeAsset,
    ResumeVersion,
    ReusableAnswer,
    SavedJob,
    Skill,
    User,
    UserContactInfo,
)
from careeros_api.resume_storage import LocalResumeAssetStorage

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/me", tags=["account"])

EXPORT_FORMAT_VERSION = 1
# Internal bookkeeping that means nothing outside the service.
_EXCLUDED_COLUMNS = frozenset({"storage_key"})


def _row(entity: Base) -> dict[str, Any]:
    return {
        column.key: getattr(entity, column.key)
        for column in entity.__table__.columns
        if column.key not in _EXCLUDED_COLUMNS
    }


async def _rows(session: AsyncSession, statement: Select[Any]) -> list[dict[str, Any]]:
    return [_row(entity) for entity in (await session.scalars(statement)).all()]


async def build_account_export(session: AsyncSession, user: User) -> dict[str, Any]:
    """Collect every record owned by the user, in plain JSON-safe form."""
    brain_id = await session.scalar(select(CareerBrain.id).where(CareerBrain.user_id == user.id))
    experience_ids = select(Experience.id).where(Experience.career_brain_id == brain_id)
    project_ids = select(Project.id).where(Project.career_brain_id == brain_id)
    evidence_ids = select(CareerEvidence.id).where(CareerEvidence.career_brain_id == brain_id)
    # The user's own jobs plus shared catalog jobs they saved or applied to.
    job_ids = select(Job.id).where(
        or_(
            Job.user_id == user.id,
            Job.id.in_(select(SavedJob.job_id).where(SavedJob.user_id == user.id)),
            Job.id.in_(
                select(Application.job_id).where(
                    Application.user_id == user.id, Application.job_id.is_not(None)
                )
            ),
        )
    )
    snapshot_ids = select(JobSnapshot.id).where(JobSnapshot.job_id.in_(job_ids))
    analysis_ids = select(JobAnalysis.id).where(JobAnalysis.user_id == user.id)
    resume_ids = select(Resume.id).where(Resume.user_id == user.id)
    application_ids = select(Application.id).where(Application.user_id == user.id)

    sections: dict[str, Select[Any]] = {
        "contact_info": select(UserContactInfo).where(UserContactInfo.user_id == user.id),
        "job_preferences": select(JobPreferences).where(JobPreferences.user_id == user.id),
        "job_search_goals": select(JobSearchGoal).where(JobSearchGoal.user_id == user.id),
        "reusable_answers": select(ReusableAnswer).where(ReusableAnswer.user_id == user.id),
        "educations": select(Education).where(Education.career_brain_id == brain_id),
        "experiences": select(Experience).where(Experience.career_brain_id == brain_id),
        "experience_details": select(ExperienceDetail).where(
            ExperienceDetail.experience_id.in_(experience_ids)
        ),
        "projects": select(Project).where(Project.career_brain_id == brain_id),
        "project_details": select(ProjectDetail).where(ProjectDetail.project_id.in_(project_ids)),
        "skills": select(Skill).where(Skill.career_brain_id == brain_id),
        "career_evidence": select(CareerEvidence).where(CareerEvidence.career_brain_id == brain_id),
        "career_evidence_revisions": select(CareerEvidenceRevision).where(
            CareerEvidenceRevision.evidence_id.in_(evidence_ids)
        ),
        "resumes": select(Resume).where(Resume.user_id == user.id),
        "resume_files": select(ResumeAsset).where(ResumeAsset.user_id == user.id),
        "resume_versions": select(ResumeVersion).where(ResumeVersion.resume_id.in_(resume_ids)),
        "jobs": select(Job).where(Job.id.in_(job_ids)),
        "job_snapshots": select(JobSnapshot).where(JobSnapshot.job_id.in_(job_ids)),
        "job_requirements": select(JobRequirement).where(
            JobRequirement.job_snapshot_id.in_(snapshot_ids)
        ),
        "saved_jobs": select(SavedJob).where(SavedJob.user_id == user.id),
        "job_analyses": select(JobAnalysis).where(JobAnalysis.user_id == user.id),
        "evidence_matches": select(EvidenceMatch).where(
            EvidenceMatch.job_analysis_id.in_(analysis_ids)
        ),
        "applications": select(Application).where(Application.user_id == user.id),
        "application_answers": select(ApplicationAnswer).where(
            ApplicationAnswer.application_id.in_(application_ids)
        ),
        "application_status_history": select(ApplicationStatusHistory).where(
            ApplicationStatusHistory.application_id.in_(application_ids)
        ),
        "application_activities": select(ApplicationActivity).where(
            ApplicationActivity.application_id.in_(application_ids)
        ),
        "application_contacts": select(ApplicationContact).where(
            ApplicationContact.application_id.in_(application_ids)
        ),
    }
    data: dict[str, Any] = {
        "format_version": EXPORT_FORMAT_VERSION,
        "exported_at": datetime.now(UTC),
        "user": {"id": user.id, "email": user.email, "created_at": user.created_at},
    }
    for name, statement in sections.items():
        data[name] = await _rows(session, statement)
    return data


@router.get("/export")
async def export_account(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> JSONResponse:
    """Download all of the user's CareerOS data as one JSON document.

    Original resume files are not embedded; each version remains downloadable
    from ``/resume-versions/{id}/file``.
    """
    data = await build_account_export(session, user)
    stamp = datetime.now(UTC).strftime("%Y%m%d")
    return JSONResponse(
        content=jsonable_encoder(data),
        headers={
            "Content-Disposition": f'attachment; filename="careeros-export-{stamp}.json"',
            "Cache-Control": "no-store",
        },
    )


class DeleteAccountRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    confirm: Literal["DELETE"]


@router.delete("", status_code=status.HTTP_204_NO_CONTENT)
async def delete_account(
    body: DeleteAccountRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> Response:
    """Permanently delete every record the user owns and their resume files.

    The sign-in identity lives with the auth provider and is not removed here;
    signing in again starts a new, empty CareerOS account.
    """
    storage_keys = list(
        (
            await session.scalars(
                select(ResumeAsset.storage_key).where(ResumeAsset.user_id == user.id)
            )
        ).all()
    )
    # The Career Brain's user FK does not cascade, so remove it first; every
    # other owned table cascades from the brain or the user row.
    await session.execute(delete(CareerBrain).where(CareerBrain.user_id == user.id))
    await session.execute(delete(User).where(User.id == user.id))
    # Commit before touching files so a failed commit never leaves rows that
    # point at deleted resume files.
    await session.commit()

    storage = LocalResumeAssetStorage(settings.resume_storage_dir)
    for key in storage_keys:
        try:
            await asyncio.to_thread(storage.delete, key)
        except (OSError, ValueError):  # pragma: no cover - rows are already gone
            logger.warning("Could not remove a deleted account's resume file")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
