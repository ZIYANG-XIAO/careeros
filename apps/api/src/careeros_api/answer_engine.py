"""Reusable, policy-first Answer Engine service and authenticated API."""

import logging
import re
from dataclasses import dataclass
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from careeros_api.answer_classifier import (
    AnswerClassificationError,
    AnswerFieldClassifier,
    get_answer_field_classifier,
    validate_semantic_classifications,
)
from careeros_api.answer_engine_schemas import (
    AnswerAction,
    AnswerConfidence,
    AnswerDecision,
    AnswerFieldInput,
    AnswerPolicyCategory,
    AnswerResolutionRequest,
    AnswerResolutionResponse,
    AnswerReviewState,
    AnswerSensitivity,
    AnswerSourceCategory,
    CanonicalFieldKey,
    NormalizedControlType,
    QuestionCategory,
    ReusePolicy,
    SemanticFieldInput,
)
from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import Education, Experience, Resume, ResumeVersion, User

logger = logging.getLogger(__name__)

router = APIRouter(prefix="/answer-engine", tags=["answer-engine"])


@dataclass(frozen=True)
class ResolvedAnswer:
    value: str
    source_category: AnswerSourceCategory
    source_reference_id: UUID


SENSITIVE_RULES: tuple[tuple[re.Pattern[str], QuestionCategory], ...] = (
    (
        re.compile(r"\b(?:sponsor(?:ship)?|visa sponsorship|immigration support)\b", re.I),
        QuestionCategory.SPONSORSHIP,
    ),
    (
        re.compile(
            r"\b(?:authori[sz](?:ed|ation) to work|legally work|right to work|work eligibility)\b",
            re.I,
        ),
        QuestionCategory.WORK_AUTHORIZATION,
    ),
    (
        re.compile(
            r"\b(?:social security|ssn|passport|national id|government[- ]issued id)\b",
            re.I,
        ),
        QuestionCategory.GOVERNMENT_ID,
    ),
    (
        re.compile(
            r"\b(?:salary|compensation|desired pay|pay expectation|expected pay|pay range)\b",
            re.I,
        ),
        QuestionCategory.COMPENSATION,
    ),
    (
        re.compile(r"\b(?:disab(?:ility|led)|medical condition|accommodation)\b", re.I),
        QuestionCategory.DISABILITY,
    ),
    (
        re.compile(r"\b(?:veteran|military status|armed forces)\b", re.I),
        QuestionCategory.VETERAN,
    ),
    (
        re.compile(
            r"\b(?:race|racial|ethnicity|ethnic|gender|sexual orientation|pronouns?"
            r"|nationality|citizenship)\b",
            re.I,
        ),
        QuestionCategory.DEMOGRAPHIC,
    ),
    (
        re.compile(r"\b(?:signature|electronically sign|digital signature)\b", re.I),
        QuestionCategory.SIGNATURE,
    ),
    (
        re.compile(
            r"\b(?:attest|certify|legal terms|terms and conditions|background check"
            r"|criminal|conviction|at least 18)\b",
            re.I,
        ),
        QuestionCategory.LEGAL_ATTESTATION,
    ),
)

SENSITIVE_CATEGORIES = frozenset(
    {
        QuestionCategory.DEMOGRAPHIC,
        QuestionCategory.DISABILITY,
        QuestionCategory.VETERAN,
    }
)

EDUCATION_KEYS = frozenset(
    {
        CanonicalFieldKey.EDUCATION_SCHOOL,
        CanonicalFieldKey.EDUCATION_DEGREE,
        CanonicalFieldKey.EDUCATION_FIELD_OF_STUDY,
    }
)

EXPERIENCE_KEYS = frozenset(
    {
        CanonicalFieldKey.EXPERIENCE_COMPANY,
        CanonicalFieldKey.EXPERIENCE_TITLE,
    }
)


def classify_sensitive_question(question: str | None) -> QuestionCategory | None:
    if not question:
        return None
    for pattern, category in SENSITIVE_RULES:
        if pattern.search(question):
            return category
    return None


def answer_classifier_dependency() -> AnswerFieldClassifier | None:
    return get_answer_field_classifier()


async def _owned_resume_version(
    session: AsyncSession,
    user_id: UUID,
    version_id: UUID | None,
) -> ResumeVersion | None:
    if version_id is None:
        return None
    version = await session.scalar(
        select(ResumeVersion)
        .join(Resume)
        .options(selectinload(ResumeVersion.asset))
        .where(ResumeVersion.id == version_id, Resume.user_id == user_id)
    )
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Resume version not found",
        )
    return version


async def _load_answer_sources(
    session: AsyncSession,
    user: User,
    keys: set[CanonicalFieldKey],
    resume_version: ResumeVersion | None,
) -> dict[CanonicalFieldKey, ResolvedAnswer]:
    sources: dict[CanonicalFieldKey, ResolvedAnswer] = {}
    if CanonicalFieldKey.CONTACT_EMAIL in keys and user.email and user.email.strip():
        sources[CanonicalFieldKey.CONTACT_EMAIL] = ResolvedAnswer(
            value=user.email.strip(),
            source_category=AnswerSourceCategory.IDENTITY,
            source_reference_id=user.id,
        )

    if keys & EDUCATION_KEYS:
        educations = (
            (
                await session.execute(
                    select(Education)
                    .where(Education.career_brain_id == user.career_brain.id)
                    .order_by(Education.created_at)
                )
            )
            .scalars()
            .all()
        )
        if len(educations) == 1:
            education = educations[0]
            education_values = {
                CanonicalFieldKey.EDUCATION_SCHOOL: education.institution,
                CanonicalFieldKey.EDUCATION_DEGREE: education.degree,
                CanonicalFieldKey.EDUCATION_FIELD_OF_STUDY: education.field_of_study,
            }
            for key, value in education_values.items():
                if key in keys and value and value.strip():
                    sources[key] = ResolvedAnswer(
                        value=value.strip(),
                        source_category=AnswerSourceCategory.CAREER_BRAIN,
                        source_reference_id=education.id,
                    )

    if keys & EXPERIENCE_KEYS:
        experiences = (
            (
                await session.execute(
                    select(Experience)
                    .where(
                        Experience.career_brain_id == user.career_brain.id,
                        Experience.is_current.is_(True),
                    )
                    .order_by(Experience.created_at)
                )
            )
            .scalars()
            .all()
        )
        if len(experiences) == 1:
            experience = experiences[0]
            sources[CanonicalFieldKey.EXPERIENCE_COMPANY] = ResolvedAnswer(
                value=experience.company,
                source_category=AnswerSourceCategory.CAREER_BRAIN,
                source_reference_id=experience.id,
            )
            sources[CanonicalFieldKey.EXPERIENCE_TITLE] = ResolvedAnswer(
                value=experience.title,
                source_category=AnswerSourceCategory.CAREER_BRAIN,
                source_reference_id=experience.id,
            )

    if CanonicalFieldKey.RESUME_FILE in keys and resume_version is not None:
        sources[CanonicalFieldKey.RESUME_FILE] = ResolvedAnswer(
            value=resume_version.asset.original_filename,
            source_category=AnswerSourceCategory.RESUME_VERSION,
            source_reference_id=resume_version.id,
        )
    return sources


def _sensitive_decision(
    field: AnswerFieldInput,
    category: QuestionCategory,
) -> AnswerDecision:
    sensitivity = (
        AnswerSensitivity.SENSITIVE
        if category in SENSITIVE_CATEGORIES
        else AnswerSensitivity.CONSEQUENTIAL
    )
    policy = (
        AnswerPolicyCategory.SENSITIVE
        if sensitivity == AnswerSensitivity.SENSITIVE
        else AnswerPolicyCategory.CONSEQUENTIAL
    )
    return AnswerDecision(
        field_id=field.field_id,
        canonical_key=None,
        question_category=category,
        proposed_answer=None,
        source_category=AnswerSourceCategory.UNKNOWN,
        source_reference_id=None,
        action=AnswerAction.ASK,
        policy_category=policy,
        confidence=AnswerConfidence.HIGH,
        sensitivity=sensitivity,
        review_state=AnswerReviewState.USER_INPUT_REQUIRED,
        reuse_policy=ReusePolicy.PROHIBITED,
        save_intent_required=False,
    )


def _unsupported_decision(field: AnswerFieldInput) -> AnswerDecision:
    return AnswerDecision(
        field_id=field.field_id,
        canonical_key=None,
        question_category=QuestionCategory.UNKNOWN,
        proposed_answer=None,
        source_category=AnswerSourceCategory.UNKNOWN,
        source_reference_id=None,
        action=AnswerAction.UNKNOWN,
        policy_category=AnswerPolicyCategory.UNSUPPORTED,
        confidence=AnswerConfidence.LOW,
        sensitivity=AnswerSensitivity.NONE,
        review_state=AnswerReviewState.UNRESOLVED,
        reuse_policy=ReusePolicy.PROHIBITED,
        save_intent_required=False,
    )


def _unknown_decision(
    field: AnswerFieldInput,
    canonical_key: CanonicalFieldKey | None,
) -> AnswerDecision:
    action = AnswerAction.ASK if field.required else AnswerAction.UNKNOWN
    is_custom_question = canonical_key is None
    return AnswerDecision(
        field_id=field.field_id,
        canonical_key=canonical_key,
        question_category=(
            QuestionCategory.UNKNOWN if is_custom_question else QuestionCategory.STANDARD
        ),
        proposed_answer=None,
        source_category=AnswerSourceCategory.UNKNOWN,
        source_reference_id=None,
        action=action,
        policy_category=AnswerPolicyCategory.STANDARD,
        confidence=AnswerConfidence.LOW,
        sensitivity=AnswerSensitivity.NONE,
        review_state=(
            AnswerReviewState.USER_INPUT_REQUIRED
            if action == AnswerAction.ASK
            else AnswerReviewState.UNRESOLVED
        ),
        reuse_policy=(
            ReusePolicy.ELIGIBLE_WITH_EXPLICIT_CONSENT
            if is_custom_question
            else ReusePolicy.NOT_APPLICABLE
        ),
        save_intent_required=is_custom_question,
    )


def _resolved_decision(
    field: AnswerFieldInput,
    canonical_key: CanonicalFieldKey,
    confidence: AnswerConfidence,
    source: ResolvedAnswer,
) -> AnswerDecision:
    action = AnswerAction.FILL if confidence == AnswerConfidence.HIGH else AnswerAction.SUGGEST
    return AnswerDecision(
        field_id=field.field_id,
        canonical_key=canonical_key,
        question_category=QuestionCategory.STANDARD,
        proposed_answer=source.value,
        source_category=source.source_category,
        source_reference_id=source.source_reference_id,
        action=action,
        policy_category=AnswerPolicyCategory.STANDARD,
        confidence=confidence,
        sensitivity=AnswerSensitivity.NONE,
        review_state=(
            AnswerReviewState.NOT_REQUIRED
            if action == AnswerAction.FILL
            else AnswerReviewState.REVIEW_REQUIRED
        ),
        reuse_policy=ReusePolicy.NOT_APPLICABLE,
        save_intent_required=False,
    )


async def resolve_answer_decisions(
    request: AnswerResolutionRequest,
    user: User,
    session: AsyncSession,
    classifier: AnswerFieldClassifier | None,
) -> AnswerResolutionResponse:
    resume_version = await _owned_resume_version(
        session,
        user.id,
        request.selected_resume_version_id,
    )
    sensitive_categories = {
        field.field_id: classify_sensitive_question(field.question) for field in request.fields
    }
    semantic_candidates = [
        SemanticFieldInput(
            field_id=field.field_id,
            question=field.question,
            control_type=field.control_type,
            options=field.options,
        )
        for field in request.fields
        if field.canonical_key is None
        and sensitive_categories[field.field_id] is None
        and field.control_type
        not in {NormalizedControlType.FILE, NormalizedControlType.UNSUPPORTED}
        and field.question is not None
    ]
    semantic_results: dict[str, tuple[CanonicalFieldKey, AnswerConfidence]] = {}
    semantic_classifier_used = False
    if classifier is not None and semantic_candidates:
        try:
            classifications = validate_semantic_classifications(
                await classifier.classify_fields(semantic_candidates),
                semantic_candidates,
            )
            semantic_classifier_used = True
            semantic_results = {
                item.field_id: (item.canonical_key, item.confidence)
                for item in classifications.classifications
                if item.canonical_key is not None
            }
        except (AnswerClassificationError, ValueError):
            logger.warning("Answer field semantic classification failed safely")

    effective: dict[str, tuple[CanonicalFieldKey | None, AnswerConfidence]] = {}
    for field in request.fields:
        semantic_result = semantic_results.get(field.field_id)
        effective[field.field_id] = semantic_result or (
            field.canonical_key,
            field.mapping_confidence,
        )
    keys = {key for key, _confidence in effective.values() if key is not None}
    sources = await _load_answer_sources(session, user, keys, resume_version)

    decisions: list[AnswerDecision] = []
    for field in request.fields:
        sensitive_category = sensitive_categories[field.field_id]
        if sensitive_category is not None:
            decisions.append(_sensitive_decision(field, sensitive_category))
            continue
        if field.control_type == NormalizedControlType.UNSUPPORTED:
            decisions.append(_unsupported_decision(field))
            continue
        canonical_key, confidence = effective[field.field_id]
        source = sources.get(canonical_key) if canonical_key is not None else None
        if canonical_key is not None and source is not None:
            decisions.append(_resolved_decision(field, canonical_key, confidence, source))
        else:
            decisions.append(_unknown_decision(field, canonical_key))

    return AnswerResolutionResponse(
        decisions=decisions,
        selected_resume_version_id=resume_version.id if resume_version is not None else None,
        semantic_classifier_used=semantic_classifier_used,
    )


@router.post("/resolve", response_model=AnswerResolutionResponse)
async def resolve_answers(
    body: AnswerResolutionRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    classifier: Annotated[
        AnswerFieldClassifier | None,
        Depends(answer_classifier_dependency),
    ],
) -> AnswerResolutionResponse:
    return await resolve_answer_decisions(body, user, session, classifier)
