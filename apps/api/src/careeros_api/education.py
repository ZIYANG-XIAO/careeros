from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import Education, User

router = APIRouter(prefix="/career-brain", tags=["education"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateEducationRequest(BaseModel):
    institution: str
    degree: str | None = None
    field_of_study: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None

    @field_validator("institution", "degree", "field_of_study", "location")
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
    def check_date_consistency(self) -> "CreateEducationRequest":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        return self

    @field_validator("institution")
    @classmethod
    def institution_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("institution must not be empty")
        return v.strip()


class UpdateEducationRequest(BaseModel):
    institution: str | None = None
    degree: str | None = None
    field_of_study: str | None = None
    location: str | None = None
    start_date: str | None = None
    end_date: str | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "UpdateEducationRequest":
        for field in ("institution",):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} must not be null")
        return self

    @field_validator("institution", "degree", "field_of_study", "location")
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

    @field_validator("institution")
    @classmethod
    def institution_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("institution must not be empty")
        return v.strip() if v else v


class EducationResponse(BaseModel):
    id: UUID
    institution: str
    degree: str | None
    field_of_study: str | None
    location: str | None
    start_date: str | None
    end_date: str | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/educations", response_model=EducationResponse, status_code=status.HTTP_201_CREATED)
async def create_education(
    body: CreateEducationRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> EducationResponse:
    education = Education(
        career_brain_id=user.career_brain.id,
        institution=body.institution,
        degree=body.degree,
        field_of_study=body.field_of_study,
        location=body.location,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    session.add(education)
    await session.flush()
    return _to_response(education)


@router.get("/educations", response_model=list[EducationResponse])
async def list_educations(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[EducationResponse]:
    result = await session.execute(
        select(Education)
        .where(Education.career_brain_id == user.career_brain.id)
        .order_by(Education.created_at)
    )
    return [_to_response(e) for e in result.scalars().all()]


@router.patch("/educations/{education_id}", response_model=EducationResponse)
async def update_education(
    education_id: UUID,
    body: UpdateEducationRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> EducationResponse:
    education = await _get_owned(session, education_id, user.career_brain.id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(education, field, value)
    if education.start_date and education.end_date and education.end_date < education.start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must not be before start_date",
        )
    await session.flush()
    await session.refresh(education)
    return _to_response(education)


@router.delete("/educations/{education_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_education(
    education_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> None:
    education = await _get_owned(session, education_id, user.career_brain.id)
    await session.delete(education)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_owned(session: AsyncSession, education_id: UUID, career_brain_id: UUID) -> Education:
    result = await session.execute(
        select(Education).where(
            Education.id == education_id,
            Education.career_brain_id == career_brain_id,
        )
    )
    education = result.scalar_one_or_none()
    if education is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return education


def _to_response(e: Education) -> EducationResponse:
    return EducationResponse(
        id=e.id,
        institution=e.institution,
        degree=e.degree,
        field_of_study=e.field_of_study,
        location=e.location,
        start_date=e.start_date,
        end_date=e.end_date,
        created_at=e.created_at,
        updated_at=e.updated_at,
    )
