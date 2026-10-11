"""Whether the user's signed-in browser extension has reached the API.

The Web app cannot talk to the extension directly (it exposes no page
bridge), so the extension reports itself here and the Web reads it back.
"""

from datetime import UTC, datetime
from typing import Annotated

from fastapi import APIRouter, Depends
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import ExtensionPresence, User

router = APIRouter(prefix="/me", tags=["extension-presence"])


class ExtensionPresenceResponse(BaseModel):
    last_seen_at: datetime | None
    build_version: str | None


class ExtensionPresenceReport(BaseModel):
    model_config = ConfigDict(extra="forbid")

    build_version: str = Field(min_length=1, max_length=64, pattern=r"^[A-Za-z0-9._-]+$")


@router.get("/extension-presence", response_model=ExtensionPresenceResponse)
async def get_extension_presence(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ExtensionPresenceResponse:
    presence = await session.scalar(
        select(ExtensionPresence).where(ExtensionPresence.user_id == user.id)
    )
    if presence is None:
        return ExtensionPresenceResponse(last_seen_at=None, build_version=None)
    return ExtensionPresenceResponse(
        last_seen_at=presence.last_seen_at, build_version=presence.build_version
    )


@router.put("/extension-presence", response_model=ExtensionPresenceResponse)
async def report_extension_presence(
    body: ExtensionPresenceReport,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ExtensionPresenceResponse:
    # The timestamp is the server's, never the client's.
    now = datetime.now(UTC)
    statement = (
        insert(ExtensionPresence)
        .values(user_id=user.id, build_version=body.build_version, last_seen_at=now)
        .on_conflict_do_update(
            index_elements=["user_id"],
            set_={"build_version": body.build_version, "last_seen_at": now},
        )
    )
    await session.execute(statement)
    return ExtensionPresenceResponse(last_seen_at=now, build_version=body.build_version)
