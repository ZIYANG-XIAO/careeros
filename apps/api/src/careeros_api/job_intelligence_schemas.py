"""Structured matching contracts and invariant validation for Job Intelligence."""

from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field, field_validator

from careeros_api.job_schemas import normalize_text
from careeros_api.models import (
    EvidenceSupportStrength,
    IntelligenceClassification,
    JobRequirementCategory,
    ResumeRepresentation,
)


class RequirementInput(BaseModel):
    id: UUID
    category: str
    description: str
    normalized_value: str | None
    importance: str


class EvidenceInput(BaseModel):
    evidence_id: UUID
    revision_id: UUID
    source_type: str
    content: str


class MatchEvaluation(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requirement_id: UUID
    support_strength: EvidenceSupportStrength
    resume_representation: ResumeRepresentation
    evidence_revision_ids: list[UUID] = Field(default_factory=list, max_length=20)
    explanation: str = Field(min_length=1, max_length=4000)
    resume_source_text: str | None = Field(default=None, max_length=4000)

    @field_validator("explanation")
    @classmethod
    def explanation_not_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Match explanation must not be blank")
        return value.strip()


class MatchEvaluationBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    matches: list[MatchEvaluation] = Field(max_length=100)


def classify_match(
    support: EvidenceSupportStrength, representation: ResumeRepresentation
) -> IntelligenceClassification:
    if support == EvidenceSupportStrength.STRONG:
        if representation == ResumeRepresentation.REPRESENTED:
            return IntelligenceClassification.STRONG_EVIDENCE
        return IntelligenceClassification.HIDDEN_EVIDENCE
    if support == EvidenceSupportStrength.WEAK:
        return IntelligenceClassification.WEAK_EVIDENCE
    return IntelligenceClassification.GENUINE_GAP


def validate_match_evaluations(
    batch: MatchEvaluationBatch,
    requirements: list[RequirementInput],
    evidence: list[EvidenceInput],
    resume_text: str,
) -> dict[UUID, MatchEvaluation]:
    """Reject missing/foreign references and semantic invariant violations."""
    requirements_by_id = {item.id: item for item in requirements}
    evidence_by_revision = {item.revision_id: item for item in evidence}
    matches: dict[UUID, MatchEvaluation] = {}
    normalized_resume = normalize_text(resume_text)

    for match in batch.matches:
        requirement = requirements_by_id.get(match.requirement_id)
        if requirement is None or match.requirement_id in matches:
            raise ValueError("Matcher returned an unknown or duplicate requirement")
        if len(set(match.evidence_revision_ids)) != len(match.evidence_revision_ids):
            raise ValueError("Matcher returned duplicate evidence references")
        references: list[EvidenceInput] = []
        for revision_id in match.evidence_revision_ids:
            candidate = evidence_by_revision.get(revision_id)
            if candidate is None:
                raise ValueError("Matcher returned evidence outside the candidate set")
            references.append(candidate)

        if match.support_strength == EvidenceSupportStrength.NONE_OR_INSUFFICIENT:
            if references:
                raise ValueError("Insufficient support must not cite supporting evidence")
        elif not references:
            raise ValueError("Strong or weak support must cite evidence")

        if (
            match.support_strength == EvidenceSupportStrength.STRONG
            and requirement.category == JobRequirementCategory.SKILL.value
            and requirement.normalized_value
        ):
            required_skill = normalize_text(requirement.normalized_value)
            if not any(required_skill in normalize_text(item.content) for item in references):
                raise ValueError("Strong skill support requires direct evidence for that skill")

        if match.resume_representation == ResumeRepresentation.ABSENT:
            if match.resume_source_text is not None:
                raise ValueError("Absent resume representation cannot cite resume text")
        else:
            if not match.resume_source_text:
                raise ValueError("Represented resume evidence requires a source excerpt")
            if normalize_text(match.resume_source_text) not in normalized_resume:
                raise ValueError("Resume representation is not grounded in the selected resume")

        matches[match.requirement_id] = match

    if set(matches) != set(requirements_by_id):
        raise ValueError("Matcher must return exactly one result for every requirement")
    return matches
