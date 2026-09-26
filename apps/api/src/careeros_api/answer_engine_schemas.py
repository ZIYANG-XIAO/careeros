"""Typed contracts for safe application-answer decisions."""

from enum import StrEnum
from typing import Annotated
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, model_validator


class StrictModel(BaseModel):
    model_config = ConfigDict(extra="forbid")


class CanonicalFieldKey(StrEnum):
    PERSON_FIRST_NAME = "PERSON_FIRST_NAME"
    PERSON_LAST_NAME = "PERSON_LAST_NAME"
    PERSON_FULL_NAME = "PERSON_FULL_NAME"
    CONTACT_EMAIL = "CONTACT_EMAIL"
    CONTACT_PHONE = "CONTACT_PHONE"
    ADDRESS_LINE_1 = "ADDRESS_LINE_1"
    ADDRESS_LINE_2 = "ADDRESS_LINE_2"
    ADDRESS_CITY = "ADDRESS_CITY"
    ADDRESS_REGION = "ADDRESS_REGION"
    ADDRESS_POSTAL_CODE = "ADDRESS_POSTAL_CODE"
    ADDRESS_COUNTRY = "ADDRESS_COUNTRY"
    PROFESSIONAL_LINKEDIN_URL = "PROFESSIONAL_LINKEDIN_URL"
    PROFESSIONAL_GITHUB_URL = "PROFESSIONAL_GITHUB_URL"
    PROFESSIONAL_PORTFOLIO_URL = "PROFESSIONAL_PORTFOLIO_URL"
    EDUCATION_SCHOOL = "EDUCATION_SCHOOL"
    EDUCATION_DEGREE = "EDUCATION_DEGREE"
    EDUCATION_FIELD_OF_STUDY = "EDUCATION_FIELD_OF_STUDY"
    EXPERIENCE_COMPANY = "EXPERIENCE_COMPANY"
    EXPERIENCE_TITLE = "EXPERIENCE_TITLE"
    RESUME_FILE = "RESUME_FILE"
    COVER_LETTER_FILE = "COVER_LETTER_FILE"


class NormalizedControlType(StrEnum):
    TEXT = "TEXT"
    EMAIL = "EMAIL"
    PHONE = "PHONE"
    URL = "URL"
    TEXTAREA = "TEXTAREA"
    SELECT = "SELECT"
    RADIO_GROUP = "RADIO_GROUP"
    CHECKBOX = "CHECKBOX"
    FILE = "FILE"
    DATE = "DATE"
    NUMBER = "NUMBER"
    UNSUPPORTED = "UNSUPPORTED"


class AnswerConfidence(StrEnum):
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class AnswerAction(StrEnum):
    FILL = "FILL"
    SUGGEST = "SUGGEST"
    ASK = "ASK"
    CONFIRM = "CONFIRM"
    UNKNOWN = "UNKNOWN"


class AnswerSourceCategory(StrEnum):
    IDENTITY = "IDENTITY"
    CAREER_BRAIN = "CAREER_BRAIN"
    USER_CONTACT_INFO = "USER_CONTACT_INFO"
    RESUME_VERSION = "RESUME_VERSION"
    APPLICATION_PREFERENCE = "APPLICATION_PREFERENCE"
    REUSABLE_CONFIRMED_ANSWER = "REUSABLE_CONFIRMED_ANSWER"
    APPLICATION_CONTEXT = "APPLICATION_CONTEXT"
    UNKNOWN = "UNKNOWN"


class AnswerPolicyCategory(StrEnum):
    STANDARD = "STANDARD"
    SENSITIVE = "SENSITIVE"
    CONSEQUENTIAL = "CONSEQUENTIAL"
    UNSUPPORTED = "UNSUPPORTED"


class AnswerSensitivity(StrEnum):
    NONE = "NONE"
    SENSITIVE = "SENSITIVE"
    CONSEQUENTIAL = "CONSEQUENTIAL"


class AnswerReviewState(StrEnum):
    NOT_REQUIRED = "NOT_REQUIRED"
    REVIEW_REQUIRED = "REVIEW_REQUIRED"
    USER_INPUT_REQUIRED = "USER_INPUT_REQUIRED"
    CONFIRMATION_REQUIRED = "CONFIRMATION_REQUIRED"
    UNRESOLVED = "UNRESOLVED"


class ReusePolicy(StrEnum):
    NOT_APPLICABLE = "NOT_APPLICABLE"
    ELIGIBLE_WITH_EXPLICIT_CONSENT = "ELIGIBLE_WITH_EXPLICIT_CONSENT"
    PROHIBITED = "PROHIBITED"


class QuestionCategory(StrEnum):
    STANDARD = "STANDARD"
    UNKNOWN = "UNKNOWN"
    DEMOGRAPHIC = "DEMOGRAPHIC"
    DISABILITY = "DISABILITY"
    VETERAN = "VETERAN"
    WORK_AUTHORIZATION = "WORK_AUTHORIZATION"
    SPONSORSHIP = "SPONSORSHIP"
    COMPENSATION = "COMPENSATION"
    LEGAL_ATTESTATION = "LEGAL_ATTESTATION"
    SIGNATURE = "SIGNATURE"
    GOVERNMENT_ID = "GOVERNMENT_ID"


BoundedOption = Annotated[str, Field(min_length=1, max_length=500)]


class AnswerFieldInput(StrictModel):
    field_id: str = Field(min_length=1, max_length=200)
    canonical_key: CanonicalFieldKey | None = None
    question: str | None = Field(default=None, max_length=500)
    control_type: NormalizedControlType
    required: bool
    mapping_confidence: AnswerConfidence
    options: list[BoundedOption] = Field(default_factory=list, max_length=100)


class AnswerResolutionRequest(StrictModel):
    fields: list[AnswerFieldInput] = Field(min_length=1, max_length=200)
    selected_resume_version_id: UUID | None = None

    @model_validator(mode="after")
    def field_ids_are_unique(self) -> "AnswerResolutionRequest":
        field_ids = [field.field_id for field in self.fields]
        if len(field_ids) != len(set(field_ids)):
            raise ValueError("field_id values must be unique")
        return self


class AnswerDecision(StrictModel):
    field_id: str = Field(min_length=1, max_length=200)
    canonical_key: CanonicalFieldKey | None
    question_category: QuestionCategory
    proposed_answer: str | None = Field(max_length=2_000)
    source_category: AnswerSourceCategory
    source_reference_id: UUID | None
    action: AnswerAction
    policy_category: AnswerPolicyCategory
    confidence: AnswerConfidence
    sensitivity: AnswerSensitivity
    review_state: AnswerReviewState
    reuse_policy: ReusePolicy
    save_intent_required: bool


class AnswerResolutionResponse(StrictModel):
    decisions: list[AnswerDecision] = Field(max_length=200)
    selected_resume_version_id: UUID | None
    semantic_classifier_used: bool


class SemanticFieldInput(StrictModel):
    field_id: str = Field(min_length=1, max_length=200)
    question: str | None = Field(default=None, max_length=500)
    control_type: NormalizedControlType
    options: list[BoundedOption] = Field(default_factory=list, max_length=100)


class SemanticFieldClassification(StrictModel):
    field_id: str = Field(min_length=1, max_length=200)
    canonical_key: CanonicalFieldKey | None
    confidence: AnswerConfidence

    @model_validator(mode="after")
    def semantic_confidence_is_bounded(self) -> "SemanticFieldClassification":
        if self.confidence == AnswerConfidence.HIGH:
            raise ValueError("semantic classification cannot claim HIGH confidence")
        if self.canonical_key is None and self.confidence != AnswerConfidence.LOW:
            raise ValueError("unknown semantic classifications must have LOW confidence")
        return self


class SemanticClassificationBatch(StrictModel):
    classifications: list[SemanticFieldClassification] = Field(max_length=200)
