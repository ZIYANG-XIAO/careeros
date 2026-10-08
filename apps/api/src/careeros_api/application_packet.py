"""The Application Packet: everything one application used, in one read.

Read-only and owner-scoped. It assembles existing immutable records (the
application and its answers, the exact resume version, status history,
activities, contacts) plus the job description snapshot that was current when
the application was submitted. Applications do not pin a snapshot id yet, so
the snapshot is chosen by time and the response says which basis was used.
"""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from careeros_api.application import _activity_response, _owned_application, _response
from careeros_api.application_contacts import ContactResponse
from careeros_api.application_contacts import _response as _contact_response
from careeros_api.application_schemas import (
    ApplicationActivityResponse,
    ApplicationResponse,
    ApplicationStatusHistoryEntryResponse,
)
from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import (
    ApplicationActivity,
    ApplicationContact,
    ApplicationStatusHistory,
    JobSnapshot,
    ResumeVersion,
    User,
)

router = APIRouter(prefix="/applications", tags=["applications"])

SnapshotBasis = Literal["AT_SUBMISSION", "AT_CREATION", "EARLIEST_AVAILABLE"]


class PacketResumeVersion(BaseModel):
    id: UUID
    resume_name: str
    version_number: int
    original_filename: str
    created_at: datetime


class PacketJobSnapshot(BaseModel):
    id: UUID
    version_number: int
    description: str
    captured_at: datetime
    basis: SnapshotBasis


class ApplicationPacketResponse(BaseModel):
    application: ApplicationResponse
    resume_version: PacketResumeVersion | None
    job_snapshot: PacketJobSnapshot | None
    status_history: list[ApplicationStatusHistoryEntryResponse]
    activities: list[ApplicationActivityResponse]
    contacts: list[ContactResponse]


@router.get("/{application_id}/packet", response_model=ApplicationPacketResponse)
async def get_application_packet(
    application_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ApplicationPacketResponse:
    application = await _owned_application(session, user.id, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    resume_version: PacketResumeVersion | None = None
    if application.resume_version_id is not None:
        version = await session.scalar(
            select(ResumeVersion)
            .options(selectinload(ResumeVersion.resume), selectinload(ResumeVersion.asset))
            .where(ResumeVersion.id == application.resume_version_id)
        )
        # The version is owned through its resume; never expose another user's.
        if version is not None and version.resume.user_id == user.id:
            resume_version = PacketResumeVersion(
                id=version.id,
                resume_name=version.resume.name,
                version_number=version.version_number,
                original_filename=version.asset.original_filename,
                created_at=version.created_at,
            )

    job_snapshot: PacketJobSnapshot | None = None
    if application.job_id is not None:
        snapshots = (
            await session.scalars(
                select(JobSnapshot)
                .where(JobSnapshot.job_id == application.job_id)
                .order_by(JobSnapshot.version_number)
            )
        ).all()
        moment = application.applied_at or application.created_at
        basis: SnapshotBasis = "AT_SUBMISSION" if application.applied_at else "AT_CREATION"
        current = [snapshot for snapshot in snapshots if snapshot.created_at <= moment]
        chosen = current[-1] if current else (snapshots[0] if snapshots else None)
        if chosen is not None:
            job_snapshot = PacketJobSnapshot(
                id=chosen.id,
                version_number=chosen.version_number,
                description=chosen.raw_description,
                captured_at=chosen.created_at,
                basis=basis if current else "EARLIEST_AVAILABLE",
            )

    history = (
        await session.scalars(
            select(ApplicationStatusHistory)
            .where(ApplicationStatusHistory.application_id == application.id)
            .order_by(ApplicationStatusHistory.changed_at)
        )
    ).all()
    activities = (
        await session.scalars(
            select(ApplicationActivity)
            .where(ApplicationActivity.application_id == application.id)
            .order_by(ApplicationActivity.created_at)
        )
    ).all()
    contacts = (
        await session.scalars(
            select(ApplicationContact)
            .where(ApplicationContact.application_id == application.id)
            .order_by(ApplicationContact.created_at)
        )
    ).all()

    return ApplicationPacketResponse(
        application=_response(application),
        resume_version=resume_version,
        job_snapshot=job_snapshot,
        status_history=[
            ApplicationStatusHistoryEntryResponse(
                from_status=entry.from_status,
                to_status=entry.to_status,
                changed_at=entry.changed_at,
            )
            for entry in history
        ],
        activities=[_activity_response(activity) for activity in activities],
        contacts=[_contact_response(contact) for contact in contacts],
    )
