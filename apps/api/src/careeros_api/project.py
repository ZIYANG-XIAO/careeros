from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, field_validator, model_validator
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.orm.attributes import set_committed_value

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.evidence import (
    create_evidence,
    delete_evidence_for_source,
    delete_evidence_for_sources,
    update_evidence_content,
)
from careeros_api.models import (
    CareerEvidence,
    Project,
    ProjectDetail,
    SourceType,
    User,
)

router = APIRouter(prefix="/career-brain", tags=["project"])


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class CreateProjectRequest(BaseModel):
    name: str
    description: str | None = None
    url: str | None = None
    start_date: str | None = None
    end_date: str | None = None

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str) -> str:
        if len(v) > 500:
            raise ValueError("must be at most 500 characters")
        return v

    @field_validator("url")
    @classmethod
    def url_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 2000:
            raise ValueError("must be at most 2000 characters")
        return v

    @field_validator("start_date", "end_date")
    @classmethod
    def date_field_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 10:
            raise ValueError("must be at most 10 characters")
        return v

    @model_validator(mode="after")
    def check_date_consistency(self) -> "CreateProjectRequest":
        if self.start_date and self.end_date and self.end_date < self.start_date:
            raise ValueError("end_date must not be before start_date")
        return self

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("name must not be empty")
        return v.strip()


class UpdateProjectRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    url: str | None = None
    start_date: str | None = None
    end_date: str | None = None

    @model_validator(mode="after")
    def reject_null_required_fields(self) -> "UpdateProjectRequest":
        for field in ("name",):
            if field in self.model_fields_set and getattr(self, field) is None:
                raise ValueError(f"{field} must not be null")
        return self

    @field_validator("name")
    @classmethod
    def name_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 500:
            raise ValueError("must be at most 500 characters")
        return v

    @field_validator("url")
    @classmethod
    def url_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 2000:
            raise ValueError("must be at most 2000 characters")
        return v

    @field_validator("start_date", "end_date")
    @classmethod
    def date_field_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 10:
            raise ValueError("must be at most 10 characters")
        return v

    @field_validator("name")
    @classmethod
    def name_not_empty(cls, v: str | None) -> str | None:
        if v is not None and not v.strip():
            raise ValueError("name must not be empty")
        return v.strip() if v else v


class ProjectDetailEvidence(BaseModel):
    evidence_id: UUID
    current_revision_id: UUID | None
    current_revision_number: int | None
    confirmation_status: str | None


class ProjectDetailResponse(BaseModel):
    id: UUID
    project_id: UUID
    content: str
    evidence: ProjectDetailEvidence | None
    created_at: datetime
    updated_at: datetime


class ProjectResponse(BaseModel):
    id: UUID
    name: str
    description: str | None
    url: str | None
    start_date: str | None
    end_date: str | None
    details: list[ProjectDetailResponse]
    created_at: datetime
    updated_at: datetime


class CreateDetailRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("content must not be empty")
        return v.strip()


class UpdateDetailRequest(BaseModel):
    content: str

    @field_validator("content")
    @classmethod
    def content_not_empty(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("content must not be empty")
        return v.strip()


# ---------------------------------------------------------------------------
# Project endpoints
# ---------------------------------------------------------------------------


@router.post("/projects", response_model=ProjectResponse, status_code=status.HTTP_201_CREATED)
async def create_project(
    body: CreateProjectRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ProjectResponse:
    project = Project(
        career_brain_id=user.career_brain.id,
        name=body.name,
        description=body.description,
        url=body.url,
        start_date=body.start_date,
        end_date=body.end_date,
    )
    session.add(project)
    await session.flush()
    set_committed_value(project, "details", [])
    return _project_response(project, [])


@router.get("/projects", response_model=list[ProjectResponse])
async def list_projects(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[ProjectResponse]:
    result = await session.execute(
        select(Project)
        .options(selectinload(Project.details))
        .where(Project.career_brain_id == user.career_brain.id)
        .order_by(Project.created_at)
    )
    projects = result.scalars().all()
    return [_project_response(p, await _detail_evidences(session, p.details)) for p in projects]


@router.patch("/projects/{project_id}", response_model=ProjectResponse)
async def update_project(
    project_id: UUID,
    body: UpdateProjectRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ProjectResponse:
    project = await _get_owned_project(session, project_id, user.career_brain.id)
    for field, value in body.model_dump(exclude_unset=True).items():
        setattr(project, field, value)
    if project.start_date and project.end_date and project.end_date < project.start_date:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="end_date must not be before start_date",
        )
    await session.flush()
    await session.refresh(project)
    await session.refresh(project, ["details"])
    return _project_response(project, await _detail_evidences(session, project.details))


@router.delete("/projects/{project_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project(
    project_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> None:
    project = await _get_owned_project(session, project_id, user.career_brain.id, lock=True)
    await session.refresh(project, ["details"])
    detail_ids = [d.id for d in project.details]
    await delete_evidence_for_sources(session, SourceType.PROJECT_DETAIL, detail_ids)
    await session.delete(project)


# ---------------------------------------------------------------------------
# ProjectDetail endpoints
# ---------------------------------------------------------------------------


@router.post(
    "/projects/{project_id}/details",
    response_model=ProjectDetailResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_project_detail(
    project_id: UUID,
    body: CreateDetailRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ProjectDetailResponse:
    await _get_owned_project(session, project_id, user.career_brain.id, lock=True)

    detail = ProjectDetail(project_id=project_id, content=body.content)
    session.add(detail)
    await session.flush()

    evidence = await create_evidence(
        session,
        career_brain_id=user.career_brain.id,
        source_type=SourceType.PROJECT_DETAIL,
        source_id=detail.id,
        content=body.content,
    )
    return _detail_response(detail, evidence)


@router.patch("/project-details/{detail_id}", response_model=ProjectDetailResponse)
async def update_project_detail(
    detail_id: UUID,
    body: UpdateDetailRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ProjectDetailResponse:
    detail = await _get_owned_detail(session, detail_id, user.career_brain.id)
    detail.content = body.content
    await update_evidence_content(session, SourceType.PROJECT_DETAIL, detail.id, body.content)
    await session.flush()
    await session.refresh(detail)

    evidence = await _load_evidence(session, SourceType.PROJECT_DETAIL, detail.id)
    return _detail_response(detail, evidence)


@router.delete("/project-details/{detail_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_project_detail(
    detail_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> None:
    detail = await _get_owned_detail(session, detail_id, user.career_brain.id)
    await delete_evidence_for_source(session, SourceType.PROJECT_DETAIL, detail.id)
    await session.delete(detail)


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


async def _get_owned_project(
    session: AsyncSession,
    project_id: UUID,
    career_brain_id: UUID,
    *,
    lock: bool = False,
) -> Project:
    stmt = select(Project).where(
        Project.id == project_id,
        Project.career_brain_id == career_brain_id,
    )
    if lock:
        stmt = stmt.with_for_update()
    result = await session.execute(stmt)
    project = result.scalar_one_or_none()
    if project is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return project


async def _get_owned_detail(
    session: AsyncSession, detail_id: UUID, career_brain_id: UUID
) -> ProjectDetail:
    result = await session.execute(
        select(ProjectDetail)
        .join(Project)
        .where(ProjectDetail.id == detail_id, Project.career_brain_id == career_brain_id)
    )
    detail = result.scalar_one_or_none()
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return detail


async def _load_evidence(
    session: AsyncSession, source_type: SourceType, source_id: UUID
) -> CareerEvidence | None:
    result = await session.execute(
        select(CareerEvidence)
        .options(selectinload(CareerEvidence.current_revision))
        .where(
            CareerEvidence.source_type == source_type.value,
            CareerEvidence.source_id == source_id,
        )
    )
    return result.scalar_one_or_none()


async def _detail_evidences(
    session: AsyncSession, details: list[ProjectDetail]
) -> list[CareerEvidence | None]:
    if not details:
        return []
    detail_ids = [d.id for d in details]
    result = await session.execute(
        select(CareerEvidence)
        .options(selectinload(CareerEvidence.current_revision))
        .where(
            CareerEvidence.source_type == SourceType.PROJECT_DETAIL.value,
            CareerEvidence.source_id.in_(detail_ids),
        )
    )
    evidence_map: dict[UUID, CareerEvidence] = {e.source_id: e for e in result.scalars().all()}
    return [evidence_map.get(d.id) for d in details]


def _project_response(
    proj: Project, detail_evidences: list[CareerEvidence | None]
) -> ProjectResponse:
    detail_responses = []
    for i, detail in enumerate(proj.details if hasattr(proj, "details") and proj.details else []):
        ev = detail_evidences[i] if i < len(detail_evidences) else None
        detail_responses.append(_detail_response(detail, ev))
    return ProjectResponse(
        id=proj.id,
        name=proj.name,
        description=proj.description,
        url=proj.url,
        start_date=proj.start_date,
        end_date=proj.end_date,
        details=detail_responses,
        created_at=proj.created_at,
        updated_at=proj.updated_at,
    )


def _detail_response(
    detail: ProjectDetail, evidence: CareerEvidence | None
) -> ProjectDetailResponse:
    ev_data = None
    if evidence is not None:
        rev = evidence.current_revision
        ev_data = ProjectDetailEvidence(
            evidence_id=evidence.id,
            current_revision_id=evidence.current_revision_id,
            current_revision_number=rev.revision_number if rev else None,
            confirmation_status=rev.confirmation_status if rev else None,
        )
    return ProjectDetailResponse(
        id=detail.id,
        project_id=detail.project_id,
        content=detail.content,
        evidence=ev_data,
        created_at=detail.created_at,
        updated_at=detail.updated_at,
    )
