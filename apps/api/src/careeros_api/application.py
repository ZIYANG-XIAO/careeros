"""Authenticated durable Application Memory endpoints."""

import json
from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Annotated, Literal
from urllib.parse import urlsplit
from uuid import UUID, uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from careeros_api.application_schemas import (
    ApplicationAnswerResponse,
    ApplicationAssistantContextRequest,
    ApplicationAssistantContextResponse,
    ApplicationAssistantMatchResponse,
    ApplicationAssistantResumeOptionResponse,
    ApplicationResponse,
    ApplicationSummaryResponse,
    CreateApplicationRequest,
    RecordApplicationSubmissionRequest,
    UpdateApplicationStatusRequest,
)
from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import (
    Application,
    ApplicationAnswer,
    ApplicationAnswerSource,
    ApplicationOperation,
    ApplicationStatus,
    Job,
    Resume,
    ResumeVersion,
    User,
)

router = APIRouter(prefix="/applications", tags=["applications"])


def _fingerprint(payload: object) -> str:
    encoded = json.dumps(
        payload,
        sort_keys=True,
        separators=(",", ":"),
        ensure_ascii=True,
        default=str,
    ).encode()
    return sha256(encoded).hexdigest()


async def _owned_job(session: AsyncSession, user_id: UUID, job_id: UUID | None) -> Job | None:
    if job_id is None:
        return None
    job = await session.scalar(select(Job).where(Job.id == job_id, Job.user_id == user_id))
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return job


async def _owned_resume_version(
    session: AsyncSession,
    user_id: UUID,
    version_id: UUID | None,
) -> ResumeVersion | None:
    if version_id is None:
        return None
    version = await session.scalar(
        select(ResumeVersion)
        .join(Resume)
        .where(ResumeVersion.id == version_id, Resume.user_id == user_id)
    )
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume version not found",
        )
    return version


async def _owned_application(
    session: AsyncSession,
    user_id: UUID,
    application_id: UUID,
) -> Application | None:
    return await session.scalar(
        select(Application)
        .options(selectinload(Application.answers))
        .where(Application.id == application_id, Application.user_id == user_id)
    )


def _summary_response(application: Application) -> ApplicationSummaryResponse:
    return ApplicationSummaryResponse(
        id=application.id,
        job_id=application.job_id,
        resume_version_id=application.resume_version_id,
        origin=application.origin,
        company=application.company_snapshot,
        role=application.role_snapshot,
        application_url=application.application_url_snapshot,
        source=application.source_snapshot,
        status=application.status,
        applied_at=application.applied_at,
        status_updated_at=application.status_updated_at,
        created_at=application.created_at,
        updated_at=application.updated_at,
    )


def _response(application: Application) -> ApplicationResponse:
    summary = _summary_response(application)
    return ApplicationResponse(
        **summary.model_dump(),
        answers=[
            ApplicationAnswerResponse(
                id=answer.id,
                canonical_key=answer.canonical_key,
                question_text=answer.question_text,
                answer_text=answer.answer_text,
                source_category=answer.source_category,
                policy_category=answer.policy_category,
                sensitivity=answer.sensitivity,
                position=answer.position,
                confirmed_at=answer.confirmed_at,
                created_at=answer.created_at,
            )
            for answer in application.answers
        ],
    )


def _conflict(message: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_409_CONFLICT,
        detail={"code": "IDEMPOTENCY_CONFLICT", "message": message},
    )


def _normalized_application_url(value: str | None) -> str | None:
    if value is None:
        return None
    try:
        parsed = urlsplit(value)
        if parsed.scheme not in {"http", "https"} or parsed.hostname is None:
            return None
        port = parsed.port
    except ValueError:
        return None
    host = parsed.hostname.casefold()
    if ":" in host:
        host = f"[{host}]"
    default_port = 80 if parsed.scheme == "http" else 443
    port_suffix = f":{port}" if port is not None and port != default_port else ""
    path = parsed.path.rstrip("/") or "/"
    return f"{parsed.scheme.casefold()}://{host}{port_suffix}{path}"


def _assistant_match(
    applications: list[Application],
    application_url: str,
    now: datetime,
) -> tuple[Literal["EXACT_URL", "RECENT_PREPARING", "NONE"], Application | None]:
    normalized_url = _normalized_application_url(application_url)
    exact = [
        application
        for application in applications
        if _normalized_application_url(application.application_url_snapshot) == normalized_url
    ]
    if len(exact) == 1:
        return "EXACT_URL", exact[0]
    if len(exact) > 1:
        preparing = [
            application
            for application in exact
            if application.status == ApplicationStatus.PREPARING
        ]
        if len(preparing) == 1:
            return "EXACT_URL", preparing[0]
        return "NONE", None

    recent_cutoff = now - timedelta(hours=6)
    recent_preparing = [
        application
        for application in applications
        if application.status == ApplicationStatus.PREPARING
        and application.created_at >= recent_cutoff
        and application.created_at <= now
    ]
    if len(recent_preparing) == 1:
        return "RECENT_PREPARING", recent_preparing[0]
    return "NONE", None


@router.post("/assistant-context", response_model=ApplicationAssistantContextResponse)
async def get_application_assistant_context(
    body: ApplicationAssistantContextRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ApplicationAssistantContextResponse:
    applications = (
        (
            await session.execute(
                select(Application)
                .where(Application.user_id == user.id)
                .order_by(Application.created_at.desc())
            )
        )
        .scalars()
        .all()
    )
    match_kind, application = _assistant_match(
        list(applications), str(body.application_url), datetime.now(UTC)
    )
    resume_rows = (
        await session.execute(
            select(ResumeVersion.id, Resume.name, ResumeVersion.version_number)
            .join(Resume)
            .where(Resume.user_id == user.id)
            .order_by(
                Resume.is_primary.desc(),
                Resume.updated_at.desc(),
                ResumeVersion.version_number.desc(),
            )
        )
    ).all()
    return ApplicationAssistantContextResponse(
        match_kind=match_kind,
        application=(
            ApplicationAssistantMatchResponse(
                id=application.id,
                company=application.company_snapshot,
                role=application.role_snapshot,
                application_url=application.application_url_snapshot,
                resume_version_id=application.resume_version_id,
                status=application.status,
                origin=application.origin,
                created_at=application.created_at,
            )
            if application is not None
            else None
        ),
        resume_versions=[
            ApplicationAssistantResumeOptionResponse(
                id=version_id,
                label=f"{resume_name} · Version {version_number}",
            )
            for version_id, resume_name, version_number in resume_rows
        ],
    )


@router.post("", response_model=ApplicationResponse, status_code=status.HTTP_201_CREATED)
async def create_application(
    body: CreateApplicationRequest,
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ApplicationResponse:
    request_fingerprint = _fingerprint(body.model_dump(mode="json"))
    existing = await session.scalar(
        select(Application)
        .options(selectinload(Application.answers))
        .where(
            Application.user_id == user.id,
            Application.idempotency_key == body.idempotency_key,
        )
    )
    if existing is not None:
        if existing.request_fingerprint != request_fingerprint:
            raise _conflict("The create idempotency key was already used differently")
        response.status_code = status.HTTP_200_OK
        return _response(existing)

    job = await _owned_job(session, user.id, body.job_id)
    resume_version = await _owned_resume_version(session, user.id, body.resume_version_id)
    if (
        any(
            answer.source_category == ApplicationAnswerSource.RESUME_VERSION
            for answer in body.answers
        )
        and resume_version is None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="RESUME_VERSION answers require a selected resume version",
        )

    company = job.company if job is not None else body.company
    role = job.title if job is not None else body.role
    if company is None or role is None:  # pragma: no cover - schema invariant
        raise RuntimeError("Application context is incomplete")
    application_url: str | None
    if body.application_url is not None:
        application_url = str(body.application_url)
    elif job is not None:
        application_url = job.application_url or job.source_url
    else:
        application_url = None
    source_snapshot = body.source or (
        job.source_key if job is not None else body.origin.value.lower()
    )
    now = datetime.now(UTC)
    applied_at = body.applied_at
    if body.status != ApplicationStatus.PREPARING and applied_at is None:
        applied_at = now

    application_id = uuid4()
    inserted_id = (
        await session.execute(
            insert(Application)
            .values(
                id=application_id,
                user_id=user.id,
                job_id=job.id if job is not None else None,
                resume_version_id=resume_version.id if resume_version is not None else None,
                origin=body.origin.value,
                company_snapshot=company,
                role_snapshot=role,
                application_url_snapshot=application_url,
                source_snapshot=source_snapshot,
                status=body.status.value,
                applied_at=applied_at,
                status_updated_at=now,
                idempotency_key=body.idempotency_key,
                request_fingerprint=request_fingerprint,
                created_at=now,
                updated_at=now,
            )
            .on_conflict_do_nothing(
                index_elements=[Application.user_id, Application.idempotency_key]
            )
            .returning(Application.id)
        )
    ).scalar_one_or_none()

    if inserted_id is None:
        raced_application = await session.scalar(
            select(Application)
            .options(selectinload(Application.answers))
            .where(
                Application.user_id == user.id,
                Application.idempotency_key == body.idempotency_key,
            )
        )
        if raced_application is None:  # pragma: no cover - database invariant
            raise RuntimeError("Idempotent application could not be loaded")
        if raced_application.request_fingerprint != request_fingerprint:
            raise _conflict("The create idempotency key was already used differently")
        response.status_code = status.HTTP_200_OK
        return _response(raced_application)

    for position, answer in enumerate(body.answers):
        session.add(
            ApplicationAnswer(
                application_id=application_id,
                canonical_key=answer.canonical_key.value if answer.canonical_key else None,
                question_text=answer.question_text,
                answer_text=answer.answer_text,
                source_category=answer.source_category.value,
                policy_category=answer.policy_category,
                sensitivity=answer.sensitivity,
                position=position,
                confirmed_at=now,
            )
        )
    await session.flush()
    created = await _owned_application(session, user.id, application_id)
    if created is None:  # pragma: no cover - defensive invariant
        raise RuntimeError("Created application could not be loaded")
    return _response(created)


@router.get("", response_model=list[ApplicationSummaryResponse])
async def list_applications(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    application_status: Annotated[ApplicationStatus | None, Query(alias="status")] = None,
) -> list[ApplicationSummaryResponse]:
    statement = (
        select(Application)
        .where(Application.user_id == user.id)
        .order_by(Application.created_at.desc())
    )
    if application_status is not None:
        statement = statement.where(Application.status == application_status.value)
    applications = (await session.execute(statement)).scalars().all()
    return [_summary_response(application) for application in applications]


@router.get("/{application_id}", response_model=ApplicationResponse)
async def get_application(
    application_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ApplicationResponse:
    application = await _owned_application(session, user.id, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    return _response(application)


@router.patch("/{application_id}/status", response_model=ApplicationResponse)
async def update_application_status(
    application_id: UUID,
    body: UpdateApplicationStatusRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ApplicationResponse:
    application = await _owned_application(session, user.id, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")
    if (
        body.applied_at is not None
        and application.applied_at is not None
        and body.applied_at != application.applied_at
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="applied_at is already preserved for this application",
        )

    request_fingerprint = _fingerprint(
        {
            "application_id": str(application_id),
            "status": body.status.value,
            "applied_at": body.applied_at.isoformat() if body.applied_at else "AUTO",
        }
    )
    operation_id = (
        await session.execute(
            insert(ApplicationOperation)
            .values(
                id=uuid4(),
                user_id=user.id,
                application_id=application.id,
                idempotency_key=body.idempotency_key,
                request_fingerprint=request_fingerprint,
                operation_type="STATUS_UPDATE",
            )
            .on_conflict_do_nothing(
                index_elements=[
                    ApplicationOperation.user_id,
                    ApplicationOperation.idempotency_key,
                ]
            )
            .returning(ApplicationOperation.id)
        )
    ).scalar_one_or_none()
    if operation_id is None:
        operation = await session.scalar(
            select(ApplicationOperation).where(
                ApplicationOperation.user_id == user.id,
                ApplicationOperation.idempotency_key == body.idempotency_key,
            )
        )
        if (
            operation is None
            or operation.application_id != application.id
            or operation.request_fingerprint != request_fingerprint
            or operation.operation_type != "STATUS_UPDATE"
        ):
            raise _conflict("The update idempotency key was already used differently")
        refreshed = await session.scalar(
            select(Application)
            .options(selectinload(Application.answers))
            .execution_options(populate_existing=True)
            .where(Application.id == application.id, Application.user_id == user.id)
        )
        if refreshed is None:  # pragma: no cover - defensive invariant
            raise RuntimeError("Updated application could not be reloaded")
        return _response(refreshed)

    now = datetime.now(UTC)
    if application.applied_at is None and body.status != ApplicationStatus.PREPARING:
        application.applied_at = body.applied_at or now
    application.status = body.status.value
    application.status_updated_at = now
    application.updated_at = now
    await session.flush()
    return _response(application)


@router.post("/{application_id}/submission", response_model=ApplicationResponse)
async def record_application_submission(
    application_id: UUID,
    body: RecordApplicationSubmissionRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ApplicationResponse:
    application = await _owned_application(session, user.id, application_id)
    if application is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")

    request_fingerprint = _fingerprint(
        {"application_id": str(application_id), **body.model_dump(mode="json")}
    )
    existing_operation = await session.scalar(
        select(ApplicationOperation).where(
            ApplicationOperation.user_id == user.id,
            ApplicationOperation.idempotency_key == body.idempotency_key,
        )
    )
    if existing_operation is not None:
        if (
            existing_operation.application_id != application.id
            or existing_operation.request_fingerprint != request_fingerprint
            or existing_operation.operation_type != "RECORD_SUBMISSION"
        ):
            raise _conflict("The submission idempotency key was already used differently")
        return _response(application)

    resume_version = await _owned_resume_version(session, user.id, body.resume_version_id)
    if (
        application.resume_version_id is not None
        and resume_version is not None
        and application.resume_version_id != resume_version.id
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="The exact resume version is already preserved for this application",
        )
    effective_resume_version_id = application.resume_version_id or (
        resume_version.id if resume_version is not None else None
    )
    if (
        any(
            answer.source_category == ApplicationAnswerSource.RESUME_VERSION
            for answer in body.answers
        )
        and effective_resume_version_id is None
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="RESUME_VERSION answers require a selected resume version",
        )
    if (
        body.applied_at is not None
        and application.applied_at is not None
        and body.applied_at != application.applied_at
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="applied_at is already preserved for this application",
        )

    operation_id = (
        await session.execute(
            insert(ApplicationOperation)
            .values(
                id=uuid4(),
                user_id=user.id,
                application_id=application.id,
                idempotency_key=body.idempotency_key,
                request_fingerprint=request_fingerprint,
                operation_type="RECORD_SUBMISSION",
            )
            .on_conflict_do_nothing(
                index_elements=[
                    ApplicationOperation.user_id,
                    ApplicationOperation.idempotency_key,
                ]
            )
            .returning(ApplicationOperation.id)
        )
    ).scalar_one_or_none()
    if operation_id is None:
        raced_operation = await session.scalar(
            select(ApplicationOperation).where(
                ApplicationOperation.user_id == user.id,
                ApplicationOperation.idempotency_key == body.idempotency_key,
            )
        )
        if (
            raced_operation is None
            or raced_operation.application_id != application.id
            or raced_operation.request_fingerprint != request_fingerprint
            or raced_operation.operation_type != "RECORD_SUBMISSION"
        ):
            raise _conflict("The submission idempotency key was already used differently")
        refreshed = await session.scalar(
            select(Application)
            .options(selectinload(Application.answers))
            .execution_options(populate_existing=True)
            .where(Application.id == application.id, Application.user_id == user.id)
        )
        if refreshed is None:  # pragma: no cover - defensive invariant
            raise RuntimeError("Submitted application could not be reloaded")
        return _response(refreshed)

    now = datetime.now(UTC)
    if application.resume_version_id is None and resume_version is not None:
        application.resume_version_id = resume_version.id
    if application.applied_at is None:
        application.applied_at = body.applied_at or now
    if application.status == ApplicationStatus.PREPARING:
        application.status = ApplicationStatus.APPLIED.value
    application.status_updated_at = now
    application.updated_at = now

    next_position = len(application.answers)
    for offset, answer in enumerate(body.answers):
        application.answers.append(
            ApplicationAnswer(
                canonical_key=answer.canonical_key.value if answer.canonical_key else None,
                question_text=answer.question_text,
                answer_text=answer.answer_text,
                source_category=answer.source_category.value,
                policy_category=answer.policy_category,
                sensitivity=answer.sensitivity,
                position=next_position + offset,
                confirmed_at=now,
            )
        )
    await session.flush()
    return _response(application)
