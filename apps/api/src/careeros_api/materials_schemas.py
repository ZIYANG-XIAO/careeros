"""Schemas and deterministic grounding checks for evidence-grounded materials.

Every generated suggestion, draft, or prep item must cite confirmed Career
Evidence revisions from the candidate set it was given. Validation is
server-side and model-independent:

* cited evidence and requirement ids must come from the supplied inputs;
* text a suggestion claims to rewrite or anchor to must exist verbatim in the
  selected resume;
* new text may not introduce a number that appears in neither the cited
  evidence nor the original line — numbers are where fabrication is most
  damaging and easiest to check.

Items failing a check are dropped, never repaired, and the caller reports how
many were dropped.
"""

import re
from typing import Literal
from uuid import UUID

from pydantic import BaseModel, ConfigDict, Field

from careeros_api.job_intelligence_schemas import EvidenceInput, RequirementInput

_NUMBER = re.compile(r"\d+(?:[.,]\d+)*")


def numbers_in(text: str) -> set[str]:
    return {match.replace(",", "") for match in _NUMBER.findall(text)}


def introduces_unsupported_numbers(new_text: str, *sources: str) -> bool:
    allowed: set[str] = set()
    for source in sources:
        allowed |= numbers_in(source)
    return not numbers_in(new_text) <= allowed


# ---------------------------------------------------------------------------
# Resume tailoring
# ---------------------------------------------------------------------------


class TailoringSuggestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    kind: Literal["REWRITE", "INSERT"]
    # REWRITE: an exact resume excerpt to replace. INSERT: null.
    original_text: str | None
    # INSERT: an exact resume excerpt to insert the new line after.
    insert_after: str | None
    suggested_text: str = Field(min_length=1, max_length=600)
    requirement_ids: list[UUID] = Field(max_length=10)
    evidence_revision_ids: list[UUID] = Field(max_length=10)
    rationale: str = Field(min_length=1, max_length=600)


class TailoringBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    suggestions: list[TailoringSuggestion] = Field(max_length=20)


def valid_tailoring_suggestions(
    batch: TailoringBatch,
    requirements: list[RequirementInput],
    evidence: list[EvidenceInput],
    resume_text: str,
) -> list[TailoringSuggestion]:
    requirement_ids = {item.id for item in requirements}
    evidence_by_revision = {item.revision_id: item for item in evidence}
    kept: list[TailoringSuggestion] = []
    for suggestion in batch.suggestions:
        if not suggestion.requirement_ids or not suggestion.evidence_revision_ids:
            continue
        if not set(suggestion.requirement_ids) <= requirement_ids:
            continue
        if not set(suggestion.evidence_revision_ids) <= evidence_by_revision.keys():
            continue
        if suggestion.kind == "REWRITE":
            if not suggestion.original_text or suggestion.original_text not in resume_text:
                continue
        elif not suggestion.insert_after or suggestion.insert_after not in resume_text:
            continue
        cited = [evidence_by_revision[rid].content for rid in suggestion.evidence_revision_ids]
        if introduces_unsupported_numbers(
            suggestion.suggested_text, suggestion.original_text or "", *cited
        ):
            continue
        kept.append(suggestion)
    return kept


def apply_tailoring(resume_text: str, edits: list[tuple[str, str | None, str | None, str]]) -> str:
    """Apply accepted (kind, original_text, insert_after, text) edits in order.

    Anchors are matched verbatim against the text as edited so far; an edit
    whose anchor no longer exists raises ValueError instead of guessing.
    """
    result = resume_text
    for kind, original, insert_after, text in edits:
        if kind == "REWRITE":
            if not original or original not in result:
                raise ValueError("A rewritten line no longer matches the resume")
            result = result.replace(original, text, 1)
        else:
            if not insert_after or insert_after not in result:
                raise ValueError("An insertion point no longer matches the resume")
            index = result.index(insert_after) + len(insert_after)
            result = result[:index] + "\n" + text + result[index:]
    return result


# ---------------------------------------------------------------------------
# Cover letter / open-question drafts
# ---------------------------------------------------------------------------


class DraftResult(BaseModel):
    model_config = ConfigDict(extra="forbid")

    text: str = Field(min_length=1, max_length=6000)
    evidence_revision_ids: list[UUID] = Field(max_length=20)
    # Things the question asks about that the evidence cannot support; the
    # draft must not claim them, and the UI shows them to the user.
    unsupported_points: list[str] = Field(max_length=10)


def valid_draft(draft: DraftResult, evidence: list[EvidenceInput], *sources: str) -> bool:
    evidence_by_revision = {item.revision_id: item for item in evidence}
    if not draft.evidence_revision_ids:
        return False
    if not set(draft.evidence_revision_ids) <= evidence_by_revision.keys():
        return False
    cited = [evidence_by_revision[rid].content for rid in draft.evidence_revision_ids]
    return not introduces_unsupported_numbers(draft.text, *cited, *sources)


# ---------------------------------------------------------------------------
# Interview preparation
# ---------------------------------------------------------------------------


class PrepStory(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requirement_ids: list[UUID] = Field(max_length=10)
    evidence_revision_ids: list[UUID] = Field(max_length=10)
    prompt: str = Field(min_length=1, max_length=600)


class PrepQuestion(BaseModel):
    model_config = ConfigDict(extra="forbid")

    question: str = Field(min_length=1, max_length=400)
    requirement_ids: list[UUID] = Field(max_length=10)
    evidence_revision_ids: list[UUID] = Field(max_length=10)


class PrepGap(BaseModel):
    model_config = ConfigDict(extra="forbid")

    requirement_id: UUID
    honest_framing: str = Field(min_length=1, max_length=600)


class InterviewPrepBatch(BaseModel):
    model_config = ConfigDict(extra="forbid")

    stories: list[PrepStory] = Field(max_length=12)
    questions: list[PrepQuestion] = Field(max_length=15)
    gaps: list[PrepGap] = Field(max_length=12)


def valid_interview_prep(
    batch: InterviewPrepBatch,
    requirements: list[RequirementInput],
    evidence: list[EvidenceInput],
) -> tuple[InterviewPrepBatch, int]:
    requirement_ids = {item.id for item in requirements}
    revision_ids = {item.revision_id for item in evidence}

    def cites_known(req_ids: list[UUID], rev_ids: list[UUID]) -> bool:
        return bool(req_ids) and set(req_ids) <= requirement_ids and set(rev_ids) <= revision_ids

    # A story must rest on at least one piece of the user's real evidence.
    stories = [
        item
        for item in batch.stories
        if item.evidence_revision_ids
        and cites_known(item.requirement_ids, item.evidence_revision_ids)
    ]
    questions = [
        item
        for item in batch.questions
        if cites_known(item.requirement_ids, item.evidence_revision_ids)
    ]
    gaps = [item for item in batch.gaps if item.requirement_id in requirement_ids]
    dropped = (
        len(batch.stories)
        - len(stories)
        + len(batch.questions)
        - len(questions)
        + len(batch.gaps)
        - len(gaps)
    )
    return InterviewPrepBatch(stories=stories, questions=questions, gaps=gaps), dropped
