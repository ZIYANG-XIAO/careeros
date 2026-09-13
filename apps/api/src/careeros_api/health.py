from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from careeros_api.config import Settings, get_settings
from careeros_api.db import database_is_connected

router = APIRouter(tags=["system"])


class HealthResponse(BaseModel):
    status: Literal["ok"]
    database: Literal["connected"]


async def get_database_status(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Literal["connected"]:
    try:
        await database_is_connected(settings.database_url)
    except (OSError, SQLAlchemyError) as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="Database unavailable",
        ) from error
    return "connected"


@router.get("/health", response_model=HealthResponse)
async def health(
    database: Annotated[Literal["connected"], Depends(get_database_status)],
) -> HealthResponse:
    return HealthResponse(status="ok", database=database)
