"""Typed API contracts for durable Application Memory."""

from datetime import datetime
from typing import Literal
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator, model_validator

from careeros_api.answer_engine_schemas import CanonicalFieldKey
from careeros_api.models import (
    ApplicationAnswerSource,
    ApplicationOrigin,
    ApplicationStatus,
)


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)


class CreateApplicationAnswer(StrictModel):
    canonical_key: CanonicalFieldKey | None = None
    question_text: str = Field(min_length=1, max_length=500)
    answer_text: str = Field(min_length=1, max_length=4_000)
    source_category: ApplicationAnswerSource
    policy_category: Literal["STANDARD"]
    sensitivity: Literal["NONE"]
    user_confirmed: Literal[True]

    @field_validator("question_text", "answer_text")
    @classmethod
    def reject_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Application answer text must not be blank")
        return value.strip()


class CreateApplicationRequest(StrictModel):
    idempotency_key: UUID
    origin: ApplicationOrigin
    job_id: UUID | None = None
    company: str | None = Field(default=None, max_length=500)
    role: str | None = Field(default=None, max_length=500)
    application_url: AnyHttpUrl | None = None
    source: str | None = Field(default=None, max_length=100)
    resume_version_id: UUID | None = None
    status: ApplicationStatus = ApplicationStatus.PREPARING
    applied_at: datetime | None = None
    answers: list[CreateApplicationAnswer] = Field(default_factory=list, max_length=200)

    @field_validator("company", "role", "source")
    @classmethod
    def normalize_optional_text(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("applied_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("applied_at must include a timezone")
        return value

    @model_validator(mode="after")
    def context_is_complete(self) -> "CreateApplicationRequest":
        if self.origin == ApplicationOrigin.CAREEROS_JOB and self.job_id is None:
            raise ValueError("CAREEROS_JOB origin requires job_id")
        if self.job_id is None and (self.company is None or self.role is None):
            raise ValueError("External applications require company and role")
        if self.status == ApplicationStatus.PREPARING and self.applied_at is not None:
            raise ValueError("PREPARING applications cannot have applied_at")
        return self


class UpdateApplicationStatusRequest(StrictModel):
    idempotency_key: UUID
    status: ApplicationStatus
    applied_at: datetime | None = None

    @field_validator("applied_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("applied_at must include a timezone")
        return value

    @model_validator(mode="after")
    def preparing_has_no_new_applied_at(self) -> "UpdateApplicationStatusRequest":
        if self.status == ApplicationStatus.PREPARING and self.applied_at is not None:
            raise ValueError("PREPARING status cannot set applied_at")
        return self


class RecordApplicationSubmissionRequest(StrictModel):
    idempotency_key: UUID
    resume_version_id: UUID | None = None
    applied_at: datetime | None = None
    answers: list[CreateApplicationAnswer] = Field(default_factory=list, max_length=200)

    @field_validator("applied_at")
    @classmethod
    def require_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("applied_at must include a timezone")
        return value


class ApplicationAssistantContextRequest(StrictModel):
    application_url: AnyHttpUrl


class ApplicationAssistantMatchResponse(StrictModel):
    id: UUID
    company: str
    role: str
    application_url: str | None
    resume_version_id: UUID | None
    status: str
    origin: str
    market: str = Field(pattern="^(UNKNOWN|NORTH_AMERICA|CHINA)$")
    created_at: datetime


class ApplicationAssistantResumeOptionResponse(StrictModel):
    id: UUID
    label: str


class ApplicationAssistantContextResponse(StrictModel):
    match_kind: Literal["EXACT_URL", "RECENT_PREPARING", "NONE"]
    application: ApplicationAssistantMatchResponse | None
    resume_versions: list[ApplicationAssistantResumeOptionResponse]


class ApplicationAnswerResponse(StrictModel):
    id: UUID
    canonical_key: str | None
    question_text: str
    answer_text: str
    source_category: str
    policy_category: str
    sensitivity: str
    position: int
    confirmed_at: datetime
    created_at: datetime


class ApplicationSummaryResponse(StrictModel):
    id: UUID
    job_id: UUID | None
    resume_version_id: UUID | None
    origin: str
    company: str
    role: str
    application_url: str | None
    source: str
    status: str
    applied_at: datetime | None
    status_updated_at: datetime
    created_at: datetime
    updated_at: datetime


class ApplicationResponse(ApplicationSummaryResponse):
    answers: list[ApplicationAnswerResponse]


class ApplicationStatusHistoryEntryResponse(StrictModel):
    from_status: str | None
    to_status: str
    changed_at: datetime


class CreateApplicationActivityRequest(StrictModel):
    idempotency_key: UUID
    activity_type: Literal["NOTE", "FOLLOW_UP", "INTERVIEW"]
    title: str = Field(min_length=1, max_length=200)
    body: str | None = Field(default=None, max_length=4_000)
    scheduled_at: datetime | None = None

    @field_validator("title")
    @classmethod
    def reject_blank_title(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Activity title must not be blank")
        return value.strip()

    @field_validator("body")
    @classmethod
    def normalize_body(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("scheduled_at")
    @classmethod
    def require_scheduled_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("scheduled_at must include a timezone")
        return value

    @model_validator(mode="after")
    def schedule_matches_type(self) -> "CreateApplicationActivityRequest":
        if self.activity_type == "NOTE" and self.scheduled_at is not None:
            raise ValueError("Notes cannot have scheduled_at")
        if self.activity_type != "NOTE" and self.scheduled_at is None:
            raise ValueError("Follow-ups and interviews require scheduled_at")
        return self


class UpdateApplicationActivityRequest(StrictModel):
    title: str | None = Field(default=None, min_length=1, max_length=200)
    body: str | None = Field(default=None, max_length=4_000)
    scheduled_at: datetime | None = None
    completed: bool | None = None

    @field_validator("title")
    @classmethod
    def normalize_title(cls, value: str | None) -> str | None:
        if value is None:
            return None
        if not value.strip():
            raise ValueError("Activity title must not be blank")
        return value.strip()

    @field_validator("body")
    @classmethod
    def normalize_updated_body(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None

    @field_validator("scheduled_at")
    @classmethod
    def require_updated_timezone(cls, value: datetime | None) -> datetime | None:
        if value is not None and value.tzinfo is None:
            raise ValueError("scheduled_at must include a timezone")
        return value


class ApplicationActivityResponse(StrictModel):
    id: UUID
    application_id: UUID
    activity_type: Literal["NOTE", "FOLLOW_UP", "INTERVIEW"]
    title: str
    body: str | None
    scheduled_at: datetime | None
    completed_at: datetime | None
    created_at: datetime
    updated_at: datetime
