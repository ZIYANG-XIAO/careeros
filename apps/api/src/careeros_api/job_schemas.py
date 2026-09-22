"""Validated structured output for grounded job-description parsing."""

from pydantic import BaseModel, ConfigDict, Field, field_validator

from careeros_api.models import (
    JobRequirementCategory,
    JobRequirementImportance,
    RequirementConfidence,
)


def normalize_text(value: str) -> str:
    return " ".join(value.split()).casefold()


class ParsedJobRequirement(BaseModel):
    model_config = ConfigDict(extra="forbid")

    category: JobRequirementCategory
    description: str = Field(min_length=1, max_length=2000)
    normalized_value: str | None = Field(default=None, max_length=500)
    importance: JobRequirementImportance
    source_text: str = Field(min_length=1, max_length=4000)
    confidence: RequirementConfidence

    @field_validator("description", "source_text")
    @classmethod
    def reject_blank_text(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Requirement text must not be blank")
        return value.strip()

    @field_validator("normalized_value")
    @classmethod
    def normalize_optional_value(cls, value: str | None) -> str | None:
        if value is None:
            return None
        normalized = value.strip()
        return normalized or None


class ParsedJobDescription(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requirements: list[ParsedJobRequirement] = Field(min_length=1, max_length=100)


def validate_job_grounding(parsed: ParsedJobDescription, job_description: str) -> None:
    """Ensure every requirement is explicitly recoverable from the untrusted JD."""
    normalized_job = normalize_text(job_description)
    seen: set[tuple[str, str, str]] = set()
    for requirement in parsed.requirements:
        source = normalize_text(requirement.source_text)
        if source not in normalized_job:
            raise ValueError("Parsed requirement is not grounded in the job description")
        description = normalize_text(requirement.description)
        if description not in source:
            raise ValueError("Requirement description must be supported by its source_text")
        if requirement.normalized_value:
            normalized_value = normalize_text(requirement.normalized_value)
            if normalized_value not in source:
                raise ValueError(
                    "Requirement normalized_value must be supported by its source_text"
                )
        identity = (requirement.category.value, description, requirement.importance.value)
        if identity in seen:
            raise ValueError("Duplicate parsed requirement")
        seen.add(identity)
