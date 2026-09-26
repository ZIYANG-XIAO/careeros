from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import (
    CareerEvidence,
    Education,
    Experience,
    Project,
    Skill,
    SourceType,
    User,
)

router = APIRouter(tags=["career-brain"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class EducationSummary(BaseModel):
    id: UUID
    institution: str
    degree: str | None
    field_of_study: str | None
    location: str | None
    start_date: str | None
    end_date: str | None


class DetailEvidence(BaseModel):
    evidence_id: UUID
    current_revision_id: UUID | None
    current_revision_number: int | None
    confirmation_status: str | None


class DetailSummary(BaseModel):
    id: UUID
    content: str
    evidence: DetailEvidence | None


class ExperienceSummary(BaseModel):
    id: UUID
    company: str
    title: str
    location: str | None
    start_date: str | None
    end_date: str | None
    is_current: bool
    details: list[DetailSummary]


class ProjectSummary(BaseModel):
    id: UUID
    name: str
    description: str | None
    url: str | None
    start_date: str | None
    end_date: str | None
    details: list[DetailSummary]


class SkillSummary(BaseModel):
    id: UUID
    name: str
    preferred: bool
    evidence: DetailEvidence | None


class CareerBrainResponse(BaseModel):
    id: UUID
    created_at: datetime
    educations: list[EducationSummary]
    experiences: list[ExperienceSummary]
    projects: list[ProjectSummary]
    skills: list[SkillSummary]


# ---------------------------------------------------------------------------
# Endpoint
# ---------------------------------------------------------------------------


@router.get("/career-brain", response_model=CareerBrainResponse)
async def get_career_brain(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CareerBrainResponse:
    brain = user.career_brain
    brain_id = brain.id

    # Load all entities for this brain.
    educations = (
        (
            await session.execute(
                select(Education)
                .where(Education.career_brain_id == brain_id)
                .order_by(Education.created_at)
            )
        )
        .scalars()
        .all()
    )

    experiences = (
        (
            await session.execute(
                select(Experience)
                .options(selectinload(Experience.details))
                .where(Experience.career_brain_id == brain_id)
                .order_by(Experience.created_at)
            )
        )
        .scalars()
        .all()
    )

    projects = (
        (
            await session.execute(
                select(Project)
                .options(selectinload(Project.details))
                .where(Project.career_brain_id == brain_id)
                .order_by(Project.created_at)
            )
        )
        .scalars()
        .all()
    )

    skills = (
        (
            await session.execute(
                select(Skill).where(Skill.career_brain_id == brain_id).order_by(Skill.created_at)
            )
        )
        .scalars()
        .all()
    )

    # Load all evidence for this brain in one query.
    evidence_result = await session.execute(
        select(CareerEvidence)
        .options(selectinload(CareerEvidence.current_revision))
        .where(CareerEvidence.career_brain_id == brain_id)
    )
    ev_map: dict[tuple[str, UUID], CareerEvidence] = {
        (e.source_type, e.source_id): e for e in evidence_result.scalars().all()
    }

    def _ev(source_type: SourceType, source_id: UUID) -> DetailEvidence | None:
        evidence = ev_map.get((source_type.value, source_id))
        if evidence is None:
            return None
        rev = evidence.current_revision
        return DetailEvidence(
            evidence_id=evidence.id,
            current_revision_id=evidence.current_revision_id,
            current_revision_number=rev.revision_number if rev else None,
            confirmation_status=rev.confirmation_status if rev else None,
        )

    return CareerBrainResponse(
        id=brain.id,
        created_at=brain.created_at,
        educations=[
            EducationSummary(
                id=e.id,
                institution=e.institution,
                degree=e.degree,
                field_of_study=e.field_of_study,
                location=e.location,
                start_date=e.start_date,
                end_date=e.end_date,
            )
            for e in educations
        ],
        experiences=[
            ExperienceSummary(
                id=exp.id,
                company=exp.company,
                title=exp.title,
                location=exp.location,
                start_date=exp.start_date,
                end_date=exp.end_date,
                is_current=exp.is_current,
                details=[
                    DetailSummary(
                        id=d.id,
                        content=d.content,
                        evidence=_ev(SourceType.EXPERIENCE_DETAIL, d.id),
                    )
                    for d in exp.details
                ],
            )
            for exp in experiences
        ],
        projects=[
            ProjectSummary(
                id=p.id,
                name=p.name,
                description=p.description,
                url=p.url,
                start_date=p.start_date,
                end_date=p.end_date,
                details=[
                    DetailSummary(
                        id=d.id,
                        content=d.content,
                        evidence=_ev(SourceType.PROJECT_DETAIL, d.id),
                    )
                    for d in p.details
                ],
            )
            for p in projects
        ],
        skills=[
            SkillSummary(
                id=s.id,
                name=s.name,
                preferred=s.preferred,
                evidence=_ev(SourceType.SKILL, s.id),
            )
            for s in skills
        ],
    )
