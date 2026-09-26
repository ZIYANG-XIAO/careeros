"""Validated structured output for grounded resume parsing."""

from pydantic import BaseModel, ConfigDict, Field, field_validator


class GroundedModel(BaseModel):
    model_config = ConfigDict(extra="forbid")

    source_text: str = Field(min_length=1, max_length=4000)

    @field_validator("source_text")
    @classmethod
    def source_text_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("source_text must not be blank")
        return value.strip()


class ParsedEducation(GroundedModel):
    institution: str = Field(min_length=1, max_length=500)
    degree: str | None = Field(default=None, max_length=500)
    field_of_study: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=500)
    start_date: str | None = Field(default=None, max_length=10)
    end_date: str | None = Field(default=None, max_length=10)


class ParsedDetail(GroundedModel):
    content: str = Field(min_length=1, max_length=4000)


class ParsedExperience(GroundedModel):
    company: str = Field(min_length=1, max_length=500)
    title: str = Field(min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=500)
    start_date: str | None = Field(default=None, max_length=10)
    end_date: str | None = Field(default=None, max_length=10)
    is_current: bool = False
    details: list[ParsedDetail] = Field(default_factory=list, max_length=100)


class ParsedProject(GroundedModel):
    name: str = Field(min_length=1, max_length=500)
    description: str | None = Field(default=None, max_length=4000)
    url: str | None = Field(default=None, max_length=2000)
    start_date: str | None = Field(default=None, max_length=10)
    end_date: str | None = Field(default=None, max_length=10)
    details: list[ParsedDetail] = Field(default_factory=list, max_length=100)


class ParsedSkill(GroundedModel):
    name: str = Field(min_length=1, max_length=500)


class ParsedContactValue(GroundedModel):
    value: str = Field(min_length=1, max_length=2000)


class ParsedContactInfo(BaseModel):
    """Unconfirmed contact candidates kept separate from Career Evidence."""

    model_config = ConfigDict(extra="forbid")

    first_name: ParsedContactValue | None = None
    last_name: ParsedContactValue | None = None
    preferred_name: ParsedContactValue | None = None
    given_name_native: ParsedContactValue | None = None
    family_name_native: ParsedContactValue | None = None
    full_name_native: ParsedContactValue | None = None
    contact_email: ParsedContactValue | None = None
    phone: ParsedContactValue | None = None
    wechat_id: ParsedContactValue | None = None
    address_line_1: ParsedContactValue | None = None
    address_line_2: ParsedContactValue | None = None
    city: ParsedContactValue | None = None
    district: ParsedContactValue | None = None
    region: ParsedContactValue | None = None
    postal_code: ParsedContactValue | None = None
    country_code: ParsedContactValue | None = None
    linkedin_url: ParsedContactValue | None = None
    github_url: ParsedContactValue | None = None
    portfolio_url: ParsedContactValue | None = None


class ParsedResumeDraft(BaseModel):
    model_config = ConfigDict(extra="forbid")

    educations: list[ParsedEducation] = Field(default_factory=list, max_length=50)
    experiences: list[ParsedExperience] = Field(default_factory=list, max_length=100)
    projects: list[ParsedProject] = Field(default_factory=list, max_length=100)
    skills: list[ParsedSkill] = Field(default_factory=list, max_length=500)
    contact_info: ParsedContactInfo = Field(default_factory=ParsedContactInfo)


def normalize_for_grounding(value: str) -> str:
    return " ".join(value.split()).casefold()


def validate_grounding(draft: ParsedResumeDraft, resume_text: str) -> None:
    """Reject any fact whose cited evidence is not present in the source document."""
    normalized_resume = normalize_for_grounding(resume_text)
    grounded_objects: list[GroundedModel] = []
    grounded_objects.extend(draft.educations)
    for experience in draft.experiences:
        grounded_objects.append(experience)
        grounded_objects.extend(experience.details)
    for project in draft.projects:
        grounded_objects.append(project)
        grounded_objects.extend(project.details)
    grounded_objects.extend(draft.skills)
    grounded_objects.extend(
        candidate
        for field in ParsedContactInfo.model_fields
        if (candidate := getattr(draft.contact_info, field)) is not None
    )

    for item in grounded_objects:
        normalized_citation = normalize_for_grounding(item.source_text)
        if normalized_citation not in normalized_resume:
            raise ValueError("Parsed fact is not grounded in the uploaded resume")
        for field, value in item.model_dump(exclude={"source_text", "details"}).items():
            if value is None or isinstance(value, bool):
                continue
            if isinstance(value, str) and normalize_for_grounding(value) not in normalized_citation:
                raise ValueError(f"Parsed field {field} is not supported by its source_text")
        if isinstance(item, ParsedExperience) and item.is_current:
            if "present" not in normalized_citation and "current" not in normalized_citation:
                raise ValueError("Current-role status is not supported by its source_text")
