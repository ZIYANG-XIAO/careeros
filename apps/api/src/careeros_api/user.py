from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from careeros_api.auth import get_current_user
from careeros_api.models import User

router = APIRouter(tags=["identity"])


class UserResponse(BaseModel):
    id: UUID
    email: str | None
    created_at: datetime


@router.get("/me", response_model=UserResponse)
async def get_me(
    user: Annotated[User, Depends(get_current_user)],
) -> UserResponse:
    return UserResponse(id=user.id, email=user.email, created_at=user.created_at)
