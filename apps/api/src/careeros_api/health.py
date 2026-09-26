import asyncio
import time
from typing import Annotated, Literal
from urllib.error import HTTPError, URLError
from urllib.request import Request, urlopen

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.exc import SQLAlchemyError

from careeros_api.config import Settings, get_settings
from careeros_api.db import database_is_connected

router = APIRouter(tags=["system"])

JWKS_CHECK_CACHE_TTL_SECONDS = 60

_jwks_status_cache: dict[str, tuple[float, Literal["reachable", "unreachable"]]] = {}


class HealthResponse(BaseModel):
    status: Literal["ok"]
    database: Literal["connected"]


class ReadinessResponse(BaseModel):
    status: Literal["ok", "degraded"]
    database: Literal["connected", "unavailable"]
    auth_jwks: Literal["reachable", "unreachable", "unconfigured"]


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


async def get_readiness_database_status(
    settings: Annotated[Settings, Depends(get_settings)],
) -> Literal["connected", "unavailable"]:
    try:
        await database_is_connected(settings.database_url)
    except (OSError, SQLAlchemyError):
        return "unavailable"
    return "connected"


def _issuer_is_configured(issuer_url: str) -> bool:
    return bool(issuer_url.strip())


def _jwks_url_for_issuer(issuer_url: str) -> str:
    return f"{issuer_url.rstrip('/')}/.well-known/jwks.json"


def _probe_jwks_reachable(jwks_url: str, *, timeout_seconds: float = 3.0) -> bool:
    request = Request(jwks_url, method="GET", headers={"User-Agent": "CareerOS-Readiness/1.0"})
    with urlopen(request, timeout=timeout_seconds) as response:
        return 200 <= response.status < 300


def clear_jwks_status_cache() -> None:
    _jwks_status_cache.clear()


async def get_auth_jwks_status(
    settings: Settings,
    *,
    now: float | None = None,
) -> Literal["reachable", "unreachable", "unconfigured"]:
    issuer_url = settings.clerk_issuer_url
    if not _issuer_is_configured(issuer_url):
        return "unconfigured"

    cache_key = issuer_url.rstrip("/")
    current_time = time.monotonic() if now is None else now

    cached = _jwks_status_cache.get(cache_key)
    if cached is not None:
        cached_at, cached_status = cached
        if current_time - cached_at < JWKS_CHECK_CACHE_TTL_SECONDS:
            return cached_status

    jwks_url = _jwks_url_for_issuer(issuer_url)
    try:
        reachable = await asyncio.to_thread(_probe_jwks_reachable, jwks_url)
        auth_status: Literal["reachable", "unreachable"] = (
            "reachable" if reachable else "unreachable"
        )
    except (HTTPError, OSError, URLError, ValueError):
        auth_status = "unreachable"

    _jwks_status_cache[cache_key] = (current_time, auth_status)
    return auth_status


@router.get("/health", response_model=HealthResponse)
async def health(
    database: Annotated[Literal["connected"], Depends(get_database_status)],
) -> HealthResponse:
    return HealthResponse(status="ok", database=database)


@router.get("/readiness", response_model=ReadinessResponse)
async def readiness(
    settings: Annotated[Settings, Depends(get_settings)],
    database: Annotated[
        Literal["connected", "unavailable"],
        Depends(get_readiness_database_status),
    ],
) -> ReadinessResponse:
    auth_jwks = await get_auth_jwks_status(settings)
    overall_status: Literal["ok", "degraded"] = (
        "ok" if database == "connected" and auth_jwks == "reachable" else "degraded"
    )
    return ReadinessResponse(status=overall_status, database=database, auth_jwks=auth_jwks)
