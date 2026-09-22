"""Authenticated manual job capture and grounded parsing endpoints."""

from datetime import datetime
from hashlib import sha256
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.job_parser import JOB_PARSER_VERSION, JobParser, JobParsingError, get_job_parser
from careeros_api.job_schemas import ParsedJobDescription, validate_job_grounding
from careeros_api.models import Job, JobRequirement, JobSnapshot, JobSourceType, User

router = APIRouter(prefix="/jobs", tags=["jobs"])


class CreateJobRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    company: str = Field(min_length=1, max_length=500)
    title: str = Field(min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=500)
    description: str = Field(min_length=20, max_length=100_000)
    source_url: AnyHttpUrl | None = None
    application_url: AnyHttpUrl | None = None

    @field_validator("company", "title", "description")
    @classmethod
    def reject_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Value must not be blank")
        return value.strip()


class JobRequirementResponse(BaseModel):
    id: UUID
    category: str
    description: str
    normalized_value: str | None
    importance: str
    source_text: str
    confidence: str
    position: int


class JobSnapshotResponse(BaseModel):
    id: UUID
    version_number: int
    raw_description: str
    normalized_description: str
    content_sha256: str
    parser_version: str
    parser_model: str
    created_at: datetime
    requirements: list[JobRequirementResponse]


class JobResponse(BaseModel):
    id: UUID
    company: str
    title: str
    location: str | None
    source_url: str | None
    application_url: str | None
    source_type: str
    captured_at: datetime
    created_at: datetime
    updated_at: datetime
    latest_snapshot: JobSnapshotResponse


def job_parser_dependency() -> JobParser:
    try:
        return get_job_parser()
    except JobParsingError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error


def _normalize_description(value: str) -> str:
    return "\n".join(line.strip() for line in value.replace("\r\n", "\n").split("\n")).strip()


def _snapshot_response(snapshot: JobSnapshot) -> JobSnapshotResponse:
    return JobSnapshotResponse(
        id=snapshot.id,
        version_number=snapshot.version_number,
        raw_description=snapshot.raw_description,
        normalized_description=snapshot.normalized_description,
        content_sha256=snapshot.content_sha256,
        parser_version=snapshot.parser_version,
        parser_model=snapshot.parser_model,
        created_at=snapshot.created_at,
        requirements=[
            JobRequirementResponse(
                id=item.id,
                category=item.category,
                description=item.description,
                normalized_value=item.normalized_value,
                importance=item.importance,
                source_text=item.source_text,
                confidence=item.confidence,
                position=item.position,
            )
            for item in sorted(snapshot.requirements, key=lambda requirement: requirement.position)
        ],
    )


def _job_response(job: Job) -> JobResponse:
    latest = max(job.snapshots, key=lambda snapshot: snapshot.version_number)
    return JobResponse(
        id=job.id,
        company=job.company,
        title=job.title,
        location=job.location,
        source_url=job.source_url,
        application_url=job.application_url,
        source_type=job.source_type,
        captured_at=job.captured_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
        latest_snapshot=_snapshot_response(latest),
    )


async def _owned_job(session: AsyncSession, job_id: UUID, user_id: UUID) -> Job | None:
    return await session.scalar(
        select(Job)
        .options(selectinload(Job.snapshots).selectinload(JobSnapshot.requirements))
        .where(Job.id == job_id, Job.user_id == user_id)
    )


@router.post("", response_model=JobResponse, status_code=status.HTTP_201_CREATED)
async def create_job(
    body: CreateJobRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    parser: Annotated[JobParser, Depends(job_parser_dependency)],
) -> JobResponse:
    try:
        raw_parser_output = await parser.parse_job_description(body.description)
        parsed = ParsedJobDescription.model_validate(raw_parser_output)
        validate_job_grounding(parsed, body.description)
    except (JobParsingError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "JOB_PARSING_FAILED", "message": str(error)},
        ) from error

    normalized = _normalize_description(body.description)
    job = Job(
        user_id=user.id,
        company=body.company,
        title=body.title,
        location=body.location,
        source_url=str(body.source_url) if body.source_url else None,
        application_url=str(body.application_url) if body.application_url else None,
        source_type=JobSourceType.MANUAL_ENTRY.value,
    )
    session.add(job)
    await session.flush()
    snapshot = JobSnapshot(
        job_id=job.id,
        version_number=1,
        raw_description=body.description,
        normalized_description=normalized,
        content_sha256=sha256(body.description.encode()).hexdigest(),
        parser_version=JOB_PARSER_VERSION,
        parser_model=str(getattr(parser, "model", "deterministic-test-provider")),
    )
    session.add(snapshot)
    await session.flush()
    for position, requirement in enumerate(parsed.requirements):
        session.add(
            JobRequirement(
                job_snapshot_id=snapshot.id,
                category=requirement.category.value,
                description=requirement.description,
                normalized_value=requirement.normalized_value,
                importance=requirement.importance.value,
                source_text=requirement.source_text,
                confidence=requirement.confidence.value,
                position=position,
            )
        )
    await session.flush()
    loaded = await _owned_job(session, job.id, user.id)
    if loaded is None:  # pragma: no cover - defensive invariant
        raise RuntimeError("Created job could not be loaded")
    return _job_response(loaded)


@router.get("", response_model=list[JobResponse])
async def list_jobs(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[JobResponse]:
    result = await session.execute(
        select(Job)
        .options(selectinload(Job.snapshots).selectinload(JobSnapshot.requirements))
        .where(Job.user_id == user.id)
        .order_by(Job.created_at.desc())
    )
    return [_job_response(job) for job in result.scalars().all()]


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> JobResponse:
    job = await _owned_job(session, job_id, user.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return _job_response(job)
