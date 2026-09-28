"""Explicitly saved, revocable answers to custom non-sensitive application questions."""

from datetime import UTC, datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import BaseModel, ConfigDict, Field, field_validator
from sqlalchemy import select, update
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.answer_engine import classify_sensitive_question
from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import ReusableAnswer, User
from careeros_api.reusable_answer_lookup import question_key

router = APIRouter(prefix="/reusable-answers", tags=["reusable-answers"])


class SaveReusableAnswerRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    question_text: str = Field(min_length=1, max_length=500)
    answer_text: str = Field(min_length=1, max_length=2000)

    @field_validator("question_text")
    @classmethod
    def question_must_have_content(cls, value: str) -> str:
        if not question_key(value):
            raise ValueError("Question must contain words")
        return value


class ReusableAnswerResponse(BaseModel):
    id: UUID
    question_text: str
    answer_text: str
    created_at: datetime


def _response(answer: ReusableAnswer) -> ReusableAnswerResponse:
    return ReusableAnswerResponse(
        id=answer.id,
        question_text=answer.question_text,
        answer_text=answer.answer_text,
        created_at=answer.created_at,
    )


@router.get("", response_model=list[ReusableAnswerResponse])
async def list_reusable_answers(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[ReusableAnswerResponse]:
    rows = await session.scalars(
        select(ReusableAnswer)
        .where(ReusableAnswer.user_id == user.id, ReusableAnswer.revoked_at.is_(None))
        .order_by(ReusableAnswer.created_at.desc())
    )
    return [_response(row) for row in rows]


@router.post("", response_model=ReusableAnswerResponse, status_code=status.HTTP_201_CREATED)
async def save_reusable_answer(
    body: SaveReusableAnswerRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ReusableAnswerResponse:
    """Save an answer only on explicit user intent; sensitive questions are refused."""
    category = classify_sensitive_question(body.question_text)
    if category is not None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={
                "code": "SENSITIVE_QUESTION",
                "message": "Sensitive or consequential questions cannot be saved for reuse",
            },
        )
    key = question_key(body.question_text)
    await session.execute(
        update(ReusableAnswer)
        .where(
            ReusableAnswer.user_id == user.id,
            ReusableAnswer.question_key == key,
            ReusableAnswer.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    answer = ReusableAnswer(
        user_id=user.id,
        question_text=body.question_text,
        question_key=key,
        answer_text=body.answer_text,
    )
    session.add(answer)
    await session.flush()
    await session.refresh(answer)
    return _response(answer)


@router.delete("/{answer_id}", status_code=status.HTTP_204_NO_CONTENT)
async def revoke_reusable_answer(
    answer_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Response:
    result = await session.execute(
        update(ReusableAnswer)
        .where(
            ReusableAnswer.id == answer_id,
            ReusableAnswer.user_id == user.id,
            ReusableAnswer.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    if getattr(result, "rowcount", 0) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Answer not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)
