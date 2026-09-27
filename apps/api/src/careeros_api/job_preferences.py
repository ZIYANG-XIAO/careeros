from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import JobPreferences, User

router = APIRouter(tags=["job-preferences"])

MAX_LIST_ITEMS = 25
MAX_ITEM_LENGTH = 100
LIST_FIELDS = (
    "target_roles",
    "cities",
    "company_sizes",
    "industries_include",
    "industries_exclude",
    "company_blocklist",
)


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class JobPreferencesResponse(BaseModel):
    id: UUID | None
    target_roles: list[str]
    cities: list[str]
    company_sizes: list[str]
    industries_include: list[str]
    industries_exclude: list[str]
    company_blocklist: list[str]
    minimum_salary: int | None
    security_clearance_interest: bool
    created_at: datetime | None
    updated_at: datetime | None


class JobPreferencesUpsertRequest(BaseModel):
    target_roles: list[str] | None = None
    cities: list[str] | None = None
    company_sizes: list[str] | None = None
    industries_include: list[str] | None = None
    industries_exclude: list[str] | None = None
    company_blocklist: list[str] | None = None
    minimum_salary: int | None = None
    security_clearance_interest: bool | None = None

    @field_validator(*LIST_FIELDS)
    @classmethod
    def validate_list(cls, v: list[str] | None) -> list[str] | None:
        if v is None:
            return v
        if len(v) > MAX_LIST_ITEMS:
            raise ValueError(f"must have at most {MAX_LIST_ITEMS} items")
        cleaned = [item.strip() for item in v if item.strip()]
        for item in cleaned:
            if len(item) > MAX_ITEM_LENGTH:
                raise ValueError(f"each item must be at most {MAX_ITEM_LENGTH} characters")
        return cleaned

    @field_validator("minimum_salary")
    @classmethod
    def validate_minimum_salary(cls, v: int | None) -> int | None:
        if v is not None and v < 0:
            raise ValueError("must not be negative")
        return v


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/job-preferences", response_model=JobPreferencesResponse)
async def get_job_preferences(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> JobPreferencesResponse:
    result = await session.execute(select(JobPreferences).where(JobPreferences.user_id == user.id))
    preferences = result.scalar_one_or_none()
    if preferences is None:
        return _empty_response()
    return _to_response(preferences)


@router.put("/job-preferences", response_model=JobPreferencesResponse)
async def upsert_job_preferences(
    body: JobPreferencesUpsertRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> JobPreferencesResponse:
    preferences = await apply_job_preferences_updates(session, user.id, body)
    await session.refresh(preferences)
    return _to_response(preferences)


async def apply_job_preferences_updates(
    session: AsyncSession,
    user_id: UUID,
    body: JobPreferencesUpsertRequest,
) -> JobPreferences:
    updates = body.model_dump(exclude_unset=True)

    result = await session.execute(select(JobPreferences).where(JobPreferences.user_id == user_id))
    preferences = result.scalar_one_or_none()

    if preferences is None:
        try:
            async with session.begin_nested():
                preferences = JobPreferences(user_id=user_id, **updates)
                session.add(preferences)
                await session.flush()
        except IntegrityError:
            result = await session.execute(
                select(JobPreferences).where(JobPreferences.user_id == user_id)
            )
            preferences = result.scalar_one()
            _apply_updates(preferences, updates)
    else:
        _apply_updates(preferences, updates)

    await session.flush()
    return preferences


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _empty_response() -> JobPreferencesResponse:
    return JobPreferencesResponse(
        id=None,
        target_roles=[],
        cities=[],
        company_sizes=[],
        industries_include=[],
        industries_exclude=[],
        company_blocklist=[],
        minimum_salary=None,
        security_clearance_interest=False,
        created_at=None,
        updated_at=None,
    )


def _apply_updates(preferences: JobPreferences, updates: dict[str, object]) -> None:
    for field, value in updates.items():
        setattr(preferences, field, value)


def _to_response(preferences: JobPreferences) -> JobPreferencesResponse:
    return JobPreferencesResponse(
        id=preferences.id,
        target_roles=preferences.target_roles,
        cities=preferences.cities,
        company_sizes=preferences.company_sizes,
        industries_include=preferences.industries_include,
        industries_exclude=preferences.industries_exclude,
        company_blocklist=preferences.company_blocklist,
        minimum_salary=preferences.minimum_salary,
        security_clearance_interest=preferences.security_clearance_interest,
        created_at=preferences.created_at,
        updated_at=preferences.updated_at,
    )
