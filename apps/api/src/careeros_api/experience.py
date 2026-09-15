from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.evidence import (
    create_evidence,
    delete_evidence_for_source,
    delete_evidence_for_sources,
    update_evidence_content,
)
from careeros_api.models import (
    CareerEvidence,
    Experience,
    ExperienceDetail,
    SourceType,
    User,
)

router = APIRouter(prefix="/career-brain", tags=["experience"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateExperienceRequest(BaseModel):
    company: str
    title: str
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_current: bool = False

    @field_validator("company", "title", "location")
    @classmethod
    def string_field_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("must be at most 500 characters")
        return v

    @field_validator("start_date", "end_date")
    @classmethod
    def date_field_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 10:
            raise ValueError("must be at most 10 characters")
        return v

    @model_validator(mode="after")
    def check_date_consistency(self) -> "CreateExperienceRequest":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        if self.is_current and self.end_date is not None:
            raise ValueError("is_current must be false when end_date is set")
        return self

    @field_validator("company", "title")
    @classmethod
    def not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("must not be empty")
        return v.strip()


class UpdateExperienceRequest(BaseModel):
    company: str | None = None
    title: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None
    is_current: bool | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "UpdateExperienceRequest":
        for field in ("company", "title", "is_current"):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} must not be null")
        return self

    @field_validator("company", "title", "location")
    @classmethod
    def string_field_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("must be at most 500 characters")
        return v

    @field_validator("start_date", "end_date")
    @classmethod
    def date_field_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 10:
            raise ValueError("must be at most 10 characters")
        return v

    @field_validator("company", "title")
    @classmethod
    def not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("must not be empty")
        return v.strip() if v else v


class ExperienceDetailEvidence(BaseModel):
    evidence_id: UUID
    current_revision_id: UUID | None
    current_revision_number: int | None
    confirmation_status: str | None


class ExperienceDetailResponse(BaseModel):
    id: UUID
    experience_id: UUID
    content: str
    evidence: ExperienceDetailEvidence | None
    created_at: datetime
    updated_at: datetime


class ExperienceResponse(BaseModel):
    id: UUID
    company: str
    title: str
    location: str | None
    start_date: str | None
    end_date: str | None
    is_current: bool
    details: list[ExperienceDetailResponse]
    created_at: datetime
    updated_at: datetime


class CreateDetailRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("content must not be empty")
        return v.strip()


class UpdateDetailRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("content must not be empty")
        return v.strip()


# ---------------------------------------------------------------------------
# Experience endpoints
# ---------------------------------------------------------------------------


@router.post("/experiences", response_model=ExperienceResponse, status_code=status.HTTP_201_CREATED)
async def create_experience(
    body: CreateExperienceRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ExperienceResponse:
    experience = Experience(
        career_brain_id=user.career_brain.id,
        company=body.company,
        title=body.title,
        location=body.location,
        start_date=body.start_date,
        end_date=body.end_date,
        is_current=body.is_current,
    )
    session.add(experience)
    await session.flush()
    set_committed_value(experience, "details", [])
    return _experience_response(experience, [])


@router.get("/experiences", response_model=list[ExperienceResponse])
async def list_experiences(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[ExperienceResponse]:
    result = await session.execute(
        select(Experience)
        .options(selectinload(Experience.details))
        .where(Experience.career_brain_id == user.career_brain.id)
        .order_by(Experience.created_at)
    )
    experiences = result.scalars().all()
    return [
        _experience_response(exp, await _detail_evidences(session, exp.details))
        for exp in experiences
    ]


@router.patch("/experiences/{experience_id}", response_model=ExperienceResponse)
async def update_experience(
    experience_id: UUID,
    body: UpdateExperienceRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ExperienceResponse:
    experience = await _get_owned_experience(session, experience_id, user.career_brain.id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(experience, field, value)
    _validate_experience_dates(experience)
    await session.flush()
    await session.refresh(experience)
    await session.refresh(experience, ["details"])
    return _experience_response(experience, await _detail_evidences(session, experience.details))


@router.delete("/experiences/{experience_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_experience(
    experience_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> None:
    experience = await _get_owned_experience(
        session, experience_id, user.career_brain.id, lock=True
    )
    # Load details so we can clean up their evidence.
    await session.refresh(experience, ["details"])
    detail_ids = [d.id for d in experience.details]
    await delete_evidence_for_sources(session, SourceType.EXPERIENCE_DETAIL, detail_ids)
    await session.delete(experience)


# ---------------------------------------------------------------------------
# ExperienceDetail endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/experiences/{experience_id}/details",
    response_model=ExperienceDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_experience_detail(
    experience_id: UUID,
    body: CreateDetailRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ExperienceDetailResponse:
    await _get_owned_experience(session, experience_id, user.career_brain.id, lock=True)

    detail = ExperienceDetail(experience_id=experience_id, content=body.content)
    session.add(detail)
    await session.flush()

    evidence = await create_evidence(
        session,
        career_brain_id=user.career_brain.id,
        source_type=SourceType.EXPERIENCE_DETAIL,
        source_id=detail.id,
        content=body.content,
    )
    return _detail_response(detail, evidence)


@router.patch("/experience-details/{detail_id}", response_model=ExperienceDetailResponse)
async def update_experience_detail(
    detail_id: UUID,
    body: UpdateDetailRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ExperienceDetailResponse:
    detail = await _get_owned_detail(session, detail_id, user.career_brain.id)
    detail.content = body.content
    await update_evidence_content(session, SourceType.EXPERIENCE_DETAIL, detail.id, body.content)
    await session.flush()
    await session.refresh(detail)

    evidence = await _load_evidence(session, SourceType.EXPERIENCE_DETAIL, detail.id)
    return _detail_response(detail, evidence)


@router.delete("/experience-details/{detail_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_experience_detail(
    detail_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> None:
    detail = await _get_owned_detail(session, detail_id, user.career_brain.id)
    await delete_evidence_for_source(session, SourceType.EXPERIENCE_DETAIL, detail.id)
    await session.delete(detail)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _validate_experience_dates(experience: Experience) -> None:
    if (
        experience.start_date
        and experience.end_date
        and experience.end_date < experience.start_date
    ):
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must not be before start_date",
        )
    if experience.is_current and experience.end_date is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="is_current must be false when end_date is set",
        )


async def _get_owned_experience(
    session: AsyncSession,
    experience_id: UUID,
    career_brain_id: UUID,
    *,
    lock: bool = False,
) -> Experience:
    stmt = select(Experience).where(
        Experience.id == experience_id,
        Experience.career_brain_id == career_brain_id,
    )
    if lock:
        stmt = stmt.with_for_update()
    result = await session.execute(stmt)
    experience = result.scalar_one_or_none()
    if experience is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return experience


async def _get_owned_detail(
    session: AsyncSession, detail_id: UUID, career_brain_id: UUID
) -> ExperienceDetail:
    result = await session.execute(
        select(ExperienceDetail)
        .join(Experience)
        .where(
            ExperienceDetail.id == detail_id,
            Experience.career_brain_id == career_brain_id,
        )
    )
    detail = result.scalar_one_or_none()
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return detail


async def _load_evidence(
    session: AsyncSession, source_type: SourceType, source_id: UUID
) -> CareerEvidence | None:
    result = await session.execute(
        select(CareerEvidence)
        .options(selectinload(CareerEvidence.current_revision))
        .where(
            CareerEvidence.source_type == source_type.value,
            CareerEvidence.source_id == source_id,
        )
    )
    return result.scalar_one_or_none()


async def _detail_evidences(
    session: AsyncSession, details: list[ExperienceDetail]
) -> list[CareerEvidence | None]:
    """Load evidence for a list of details."""
    if not details:
        return []
    detail_ids = [d.id for d in details]
    result = await session.execute(
        select(CareerEvidence)
        .options(selectinload(CareerEvidence.current_revision))
        .where(
            CareerEvidence.source_type == SourceType.EXPERIENCE_DETAIL.value,
            CareerEvidence.source_id.in_(detail_ids),
        )
    )
    evidence_map: dict[UUID, CareerEvidence] = {e.source_id: e for e in result.scalars().all()}
    return [evidence_map.get(d.id) for d in details]


def _experience_response(
    exp: Experience, detail_evidences: list[CareerEvidence | None]
) -> ExperienceResponse:
    detail_responses = []
    for i, detail in enumerate(exp.details if hasattr(exp, "details") and exp.details else []):
        ev = detail_evidences[i] if i < len(detail_evidences) else None
        detail_responses.append(_detail_response(detail, ev))
    return ExperienceResponse(
        id=exp.id,
        company=exp.company,
        title=exp.title,
        location=exp.location,
        start_date=exp.start_date,
        end_date=exp.end_date,
        is_current=exp.is_current,
        details=detail_responses,
        created_at=exp.created_at,
        updated_at=exp.updated_at,
    )


def _detail_response(
    detail: ExperienceDetail, evidence: CareerEvidence | None
) -> ExperienceDetailResponse:
    ev_data = None
    if evidence is not None:
        rev = evidence.current_revision
        ev_data = ExperienceDetailEvidence(
            evidence_id=evidence.id,
            current_revision_id=evidence.current_revision_id,
            current_revision_number=rev.revision_number if rev else None,
            confirmation_status=rev.confirmation_status if rev else None,
        )
    return ExperienceDetailResponse(
        id=detail.id,
        experience_id=detail.experience_id,
        content=detail.content,
        evidence=ev_data,
        created_at=detail.created_at,
        updated_at=detail.updated_at,
    )
