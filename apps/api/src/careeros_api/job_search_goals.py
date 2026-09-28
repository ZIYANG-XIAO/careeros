from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import (
    BaseModel,
    ConfigDict,
    Field,
    ValidationError,
    field_validator,
    model_validator,
)
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import JobSearchGoal, Resume, User

router = APIRouter(prefix="/job-search-goals", tags=["job-search-goals"])

Market = Literal["UNKNOWN", "NORTH_AMERICA", "CHINA"]
WorkplaceType = Literal["ONSITE", "HYBRID", "REMOTE"]
EmploymentType = Literal["FULL_TIME", "PART_TIME", "CONTRACT", "INTERNSHIP"]
MAX_LIST_ITEMS = 25
MAX_ITEM_LENGTH = 100
LIST_FIELDS = (
    "country_codes",
    "target_roles",
    "cities",
    "workplace_types",
    "employment_types",
    "company_sizes",
    "industries_include",
    "industries_exclude",
    "company_blocklist",
)


class GoalFields(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str = Field(min_length=1, max_length=100)
    market: Market = "UNKNOWN"
    country_codes: list[str] = Field(default_factory=list)
    target_roles: list[str] = Field(default_factory=list)
    cities: list[str] = Field(default_factory=list)
    workplace_types: list[WorkplaceType] = Field(default_factory=list)
    employment_types: list[EmploymentType] = Field(default_factory=list)
    company_sizes: list[str] = Field(default_factory=list)
    industries_include: list[str] = Field(default_factory=list)
    industries_exclude: list[str] = Field(default_factory=list)
    company_blocklist: list[str] = Field(default_factory=list)
    minimum_salary: int | None = Field(default=None, ge=0)
    salary_currency: str | None = Field(default=None, pattern="^[A-Z]{3}$")
    default_resume_id: UUID | None = None
    security_clearance_interest: bool = False

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str) -> str:
        return value.strip()

    @field_validator(*LIST_FIELDS)
    @classmethod
    def normalize_list(cls, value: list[str]) -> list[str]:
        if len(value) > MAX_LIST_ITEMS:
            raise ValueError(f"must have at most {MAX_LIST_ITEMS} items")
        cleaned = list(dict.fromkeys(item.strip() for item in value if item.strip()))
        if any(len(item) > MAX_ITEM_LENGTH for item in cleaned):
            raise ValueError(f"each item must be at most {MAX_ITEM_LENGTH} characters")
        return cleaned

    @model_validator(mode="after")
    def validate_market_fields(self) -> "GoalFields":
        allowed_countries = {
            "UNKNOWN": set(),
            "NORTH_AMERICA": {"US", "CA"},
            "CHINA": {"CN"},
        }[self.market]
        countries = {country.upper() for country in self.country_codes}
        if not countries.issubset(allowed_countries):
            raise ValueError("country_codes do not match the selected market")
        self.country_codes = sorted(countries)
        if self.minimum_salary is not None and self.salary_currency is None:
            raise ValueError("salary_currency is required with minimum_salary")
        if self.salary_currency is not None:
            self.salary_currency = self.salary_currency.upper()
        return self


class CreateJobSearchGoalRequest(GoalFields):
    is_active: bool = False


class UpdateJobSearchGoalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    name: str | None = Field(default=None, min_length=1, max_length=100)
    market: Market | None = None
    country_codes: list[str] | None = None
    target_roles: list[str] | None = None
    cities: list[str] | None = None
    workplace_types: list[WorkplaceType] | None = None
    employment_types: list[EmploymentType] | None = None
    company_sizes: list[str] | None = None
    industries_include: list[str] | None = None
    industries_exclude: list[str] | None = None
    company_blocklist: list[str] | None = None
    minimum_salary: int | None = Field(default=None, ge=0)
    salary_currency: str | None = Field(default=None, pattern="^[A-Z]{3}$")
    default_resume_id: UUID | None = None
    security_clearance_interest: bool | None = None
    is_active: bool | None = None

    @field_validator("name")
    @classmethod
    def normalize_name(cls, value: str | None) -> str | None:
        return value.strip() if value is not None else None

    @field_validator(*LIST_FIELDS)
    @classmethod
    def normalize_list(cls, value: list[str] | None) -> list[str] | None:
        if value is None:
            return None
        return GoalFields.normalize_list(value)

    @field_validator("salary_currency")
    @classmethod
    def normalize_currency(cls, value: str | None) -> str | None:
        return value.upper() if value is not None else None


class JobSearchGoalResponse(GoalFields):
    id: UUID
    is_active: bool
    created_at: datetime
    updated_at: datetime


async def _owned_goal(session: AsyncSession, user_id: UUID, goal_id: UUID) -> JobSearchGoal:
    result = await session.execute(
        select(JobSearchGoal).where(JobSearchGoal.id == goal_id, JobSearchGoal.user_id == user_id)
    )
    goal = result.scalar_one_or_none()
    if goal is None:
        raise HTTPException(status_code=404, detail="Job search goal not found")
    return goal


async def _validate_resume(session: AsyncSession, user_id: UUID, resume_id: UUID | None) -> None:
    if resume_id is None:
        return
    result = await session.execute(
        select(Resume.id).where(Resume.id == resume_id, Resume.user_id == user_id)
    )
    if result.scalar_one_or_none() is None:
        raise HTTPException(status_code=404, detail="Resume not found")


def _validate_complete_goal(values: dict[str, object]) -> GoalFields:
    try:
        return GoalFields.model_validate(values)
    except ValidationError as error:
        raise HTTPException(status_code=422, detail=error.errors(include_context=False)) from error


@router.get("", response_model=list[JobSearchGoalResponse])
async def list_job_search_goals(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[JobSearchGoal]:
    result = await session.execute(
        select(JobSearchGoal)
        .where(JobSearchGoal.user_id == user.id)
        .order_by(JobSearchGoal.is_active.desc(), JobSearchGoal.created_at.asc())
    )
    return list(result.scalars().all())


@router.post("", response_model=JobSearchGoalResponse, status_code=status.HTTP_201_CREATED)
async def create_job_search_goal(
    body: CreateJobSearchGoalRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> JobSearchGoal:
    await _validate_resume(session, user.id, body.default_resume_id)
    existing = await session.execute(
        select(JobSearchGoal.id).where(JobSearchGoal.user_id == user.id).limit(1)
    )
    make_active = body.is_active or existing.scalar_one_or_none() is None
    if make_active:
        await session.execute(
            update(JobSearchGoal)
            .where(JobSearchGoal.user_id == user.id, JobSearchGoal.is_active.is_(True))
            .values(is_active=False)
        )
    goal = JobSearchGoal(
        user_id=user.id,
        **body.model_dump(exclude={"is_active"}),
        is_active=make_active,
    )
    session.add(goal)
    await session.flush()
    await session.refresh(goal)
    return goal


@router.patch("/{goal_id}", response_model=JobSearchGoalResponse)
async def update_job_search_goal(
    goal_id: UUID,
    body: UpdateJobSearchGoalRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> JobSearchGoal:
    goal = await _owned_goal(session, user.id, goal_id)
    updates = body.model_dump(exclude_unset=True)
    if updates.get("is_active") is False and goal.is_active:
        raise HTTPException(status_code=409, detail="Activate another goal instead")
    await _validate_resume(
        session, user.id, updates.get("default_resume_id", goal.default_resume_id)
    )
    complete = {
        field: updates.get(field, getattr(goal, field)) for field in GoalFields.model_fields
    }
    validated = _validate_complete_goal(complete)
    if updates.get("is_active") is True and not goal.is_active:
        await session.execute(
            update(JobSearchGoal)
            .where(JobSearchGoal.user_id == user.id, JobSearchGoal.id != goal.id)
            .values(is_active=False)
        )
    for field in updates:
        value = updates[field] if field == "is_active" else getattr(validated, field)
        setattr(goal, field, value)
    await session.flush()
    await session.refresh(goal)
    return goal
