from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import User

router = APIRouter(tags=["career-brain"])


class CareerBrainResponse(BaseModel):
    id: UUID
    created_at: datetime


@router.get("/career-brain", response_model=CareerBrainResponse)
async def get_career_brain(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> CareerBrainResponse:
    brain = user.career_brain
    return CareerBrainResponse(
        id=brain.id,
        created_at=brain.created_at,
    )
