"""Per-user browse feedback: "not interested" on a job, and hidden companies.

Feedback only filters what the user browses. It never deletes or edits a job,
and saved jobs, the user's own jobs, and applications are never hidden.
"""

from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import delete, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.job import _visible_job
from careeros_api.models import HiddenCompany, JobDismissal, User

router = APIRouter(tags=["job-feedback"])


def company_key(company: str) -> str:
    return company.strip().lower()


class HiddenCompanyRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    company: str = Field(min_length=1, max_length=500)

    @field_validator("company")
    @classmethod
    def reject_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("company must not be blank")
        return value.strip()


class HiddenCompanyResponse(BaseModel):
    id: UUID
    company_name: str
    created_at: datetime


@router.post("/jobs/{job_id}/dismiss", status_code=status.HTTP_204_NO_CONTENT)
async def dismiss_job(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Response:
    if await _visible_job(session, job_id, user.id) is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    await session.execute(
        insert(JobDismissal)
        .values(user_id=user.id, job_id=job_id)
        .on_conflict_do_nothing(index_elements=["user_id", "job_id"])
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.delete("/jobs/{job_id}/dismiss", status_code=status.HTTP_204_NO_CONTENT)
async def undismiss_job(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Response:
    await session.execute(
        delete(JobDismissal).where(JobDismissal.user_id == user.id, JobDismissal.job_id == job_id)
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.get("/hidden-companies", response_model=list[HiddenCompanyResponse])
async def list_hidden_companies(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[HiddenCompanyResponse]:
    rows = (
        await session.scalars(
            select(HiddenCompany)
            .where(HiddenCompany.user_id == user.id)
            .order_by(HiddenCompany.company_name)
        )
    ).all()
    return [
        HiddenCompanyResponse(id=row.id, company_name=row.company_name, created_at=row.created_at)
        for row in rows
    ]


@router.post(
    "/hidden-companies",
    response_model=HiddenCompanyResponse,
    status_code=status.HTTP_201_CREATED,
)
async def hide_company(
    body: HiddenCompanyRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> HiddenCompanyResponse:
    key = company_key(body.company)
    await session.execute(
        insert(HiddenCompany)
        .values(user_id=user.id, company_key=key, company_name=body.company)
        .on_conflict_do_nothing(index_elements=["user_id", "company_key"])
    )
    row = await session.scalar(
        select(HiddenCompany).where(
            HiddenCompany.user_id == user.id, HiddenCompany.company_key == key
        )
    )
    assert row is not None
    return HiddenCompanyResponse(
        id=row.id, company_name=row.company_name, created_at=row.created_at
    )


@router.delete("/hidden-companies/{hidden_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unhide_company(
    hidden_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Response:
    result = await session.execute(
        delete(HiddenCompany).where(HiddenCompany.id == hidden_id, HiddenCompany.user_id == user.id)
    )
    if result.rowcount == 0:  # type: ignore[attr-defined]
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
