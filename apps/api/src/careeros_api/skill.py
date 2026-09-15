from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.evidence import (
    create_evidence,
    delete_evidence_for_source,
    update_evidence_content,
)
from careeros_api.models import CareerEvidence, Skill, SourceType, User

router = APIRouter(prefix="/career-brain", tags=["skill"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateSkillRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        if len(v) > 500:
            raise ValueError("must be at most 500 characters")
        return v.strip()


class UpdateSkillRequest(BaseModel):
    name: str

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        if len(v) > 500:
            raise ValueError("must be at most 500 characters")
        return v.strip()


class SkillEvidence(BaseModel):
    evidence_id: UUID
    current_revision_id: UUID | None
    current_revision_number: int | None
    confirmation_status: str | None


class SkillResponse(BaseModel):
    id: UUID
    name: str
    evidence: SkillEvidence | None
    created_at: datetime
    updated_at: datetime


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.post("/skills", response_model=SkillResponse, status_code=status.HTTP_201_CREATED)
async def create_skill(
    body: CreateSkillRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> SkillResponse:
    skill = Skill(career_brain_id=user.career_brain.id, name=body.name)
    session.add(skill)
    await session.flush()

    evidence = await create_evidence(
        session,
        career_brain_id=user.career_brain.id,
        source_type=SourceType.SKILL,
        source_id=skill.id,
        content=body.name,
    )
    return _to_response(skill, evidence)


@router.get("/skills", response_model=list[SkillResponse])
async def list_skills(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[SkillResponse]:
    result = await session.execute(
        select(Skill)
        .where(Skill.career_brain_id == user.career_brain.id)
        .order_by(Skill.created_at)
    )
    skills = result.scalars().all()

    # Load evidence for all skills.
    skill_ids = [s.id for s in skills]
    ev_result = (
        await session.execute(
            select(CareerEvidence)
            .options(selectinload(CareerEvidence.current_revision))
            .where(
                CareerEvidence.source_type == SourceType.SKILL.value,
                CareerEvidence.source_id.in_(skill_ids),
            )
        )
        if skill_ids
        else None
    )
    ev_map: dict[UUID, CareerEvidence] = (
        {e.source_id: e for e in ev_result.scalars().all()} if ev_result else {}
    )
    return [_to_response(s, ev_map.get(s.id)) for s in skills]


@router.patch("/skills/{skill_id}", response_model=SkillResponse)
async def update_skill(
    skill_id: UUID,
    body: UpdateSkillRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> SkillResponse:
    skill = await _get_owned(session, skill_id, user.career_brain.id)
    skill.name = body.name
    await update_evidence_content(session, SourceType.SKILL, skill.id, body.name)
    await session.flush()
    await session.refresh(skill)

    evidence = await _load_evidence(session, skill.id)
    return _to_response(skill, evidence)


@router.delete("/skills/{skill_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_skill(
    skill_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> None:
    skill = await _get_owned(session, skill_id, user.career_brain.id)
    await delete_evidence_for_source(session, SourceType.SKILL, skill.id)
    await session.delete(skill)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_owned(session: AsyncSession, skill_id: UUID, career_brain_id: UUID) -> Skill:
    result = await session.execute(
        select(Skill).where(Skill.id == skill_id, Skill.career_brain_id == career_brain_id)
    )
    skill = result.scalar_one_or_none()
    if skill is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return skill


async def _load_evidence(session: AsyncSession, skill_id: UUID) -> CareerEvidence | None:
    result = await session.execute(
        select(CareerEvidence)
        .options(selectinload(CareerEvidence.current_revision))
        .where(
            CareerEvidence.source_type == SourceType.SKILL.value,
            CareerEvidence.source_id == skill_id,
        )
    )
    return result.scalar_one_or_none()


def _to_response(skill: Skill, evidence: CareerEvidence | None) -> SkillResponse:
    ev_data = None
    if evidence is not None:
        rev = evidence.current_revision
        ev_data = SkillEvidence(
            evidence_id=evidence.id,
            current_revision_id=evidence.current_revision_id,
            current_revision_number=rev.revision_number if rev else None,
            confirmation_status=rev.confirmation_status if rev else None,
        )
    return SkillResponse(
        id=skill.id,
        name=skill.name,
        evidence=ev_data,
        created_at=skill.created_at,
        updated_at=skill.updated_at,
    )
