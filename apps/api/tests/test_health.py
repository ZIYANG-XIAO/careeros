from typing import Literal

import pytest
from fastapi import status
from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from careeros_api.config import Settings
from careeros_api.health import (
    clear_jwks_status_cache,
    get_auth_jwks_status,
    get_database_status,
    get_readiness_database_status,
)
from careeros_api.main import create_app


def make_settings() -> Settings:
    return Settings.model_validate(
        {
            "database_url": "postgresql+asyncpg://unused:unused@localhost/unused",
            "web_origin": "http://localhost:3000",
            "clerk_issuer_url": "https://test.clerk.accounts.dev",
        }
    )


def test_health_reports_api_and_database_status() -> None:
    application = create_app(make_settings())

    async def connected_database() -> str:
        return "connected"

    application.dependency_overrides[get_database_status] = connected_database

    with TestClient(application) as client:
        response = client.get("/health")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {"status": "ok", "database": "connected"}


def test_health_hides_database_failure_details(monkeypatch: MonkeyPatch) -> None:
    application = create_app(make_settings())

    async def unavailable_database(database_url: str) -> bool:
        raise OSError("private connection details")

    monkeypatch.setattr("careeros_api.health.database_is_connected", unavailable_database)

    with TestClient(application) as client:
        response = client.get("/health")

    assert response.status_code == status.HTTP_503_SERVICE_UNAVAILABLE
    assert response.json() == {"detail": "Database unavailable"}


def test_readiness_reports_ok_when_database_and_jwks_are_healthy(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_jwks_status_cache()
    application = create_app(make_settings())

    async def connected_database() -> Literal["connected"]:
        return "connected"

    async def reachable_jwks(settings: Settings) -> Literal["reachable"]:
        return "reachable"

    application.dependency_overrides[get_readiness_database_status] = connected_database
    monkeypatch.setattr("careeros_api.health.get_auth_jwks_status", reachable_jwks)

    with TestClient(application) as client:
        response = client.get("/readiness")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "status": "ok",
        "database": "connected",
        "auth_jwks": "reachable",
    }


def test_readiness_reports_degraded_when_jwks_is_unreachable(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_jwks_status_cache()
    application = create_app(make_settings())

    async def connected_database() -> Literal["connected"]:
        return "connected"

    async def unreachable_jwks(settings: Settings) -> Literal["unreachable"]:
        return "unreachable"

    application.dependency_overrides[get_readiness_database_status] = connected_database
    monkeypatch.setattr("careeros_api.health.get_auth_jwks_status", unreachable_jwks)

    with TestClient(application) as client:
        response = client.get("/readiness")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "status": "degraded",
        "database": "connected",
        "auth_jwks": "unreachable",
    }


def test_readiness_reports_database_unavailable(monkeypatch: MonkeyPatch) -> None:
    clear_jwks_status_cache()
    application = create_app(make_settings())

    async def unreachable_jwks(settings: Settings) -> Literal["reachable"]:
        return "reachable"

    monkeypatch.setattr("careeros_api.health.get_auth_jwks_status", unreachable_jwks)

    async def unavailable_database(_database_url: str) -> bool:
        raise OSError("private connection details")

    monkeypatch.setattr("careeros_api.health.database_is_connected", unavailable_database)

    with TestClient(application) as client:
        response = client.get("/readiness")

    assert response.status_code == status.HTTP_200_OK
    assert response.json() == {
        "status": "degraded",
        "database": "unavailable",
        "auth_jwks": "reachable",
    }


@pytest.mark.asyncio
async def test_readiness_jwks_check_is_cached_for_sixty_seconds(
    monkeypatch: MonkeyPatch,
) -> None:
    clear_jwks_status_cache()
    call_count = 0

    def fake_probe(_jwks_url: str, *, timeout_seconds: float = 3.0) -> bool:
        nonlocal call_count
        call_count += 1
        return True

    monkeypatch.setattr("careeros_api.health._probe_jwks_reachable", fake_probe)

    settings = make_settings()

    assert await get_auth_jwks_status(settings, now=100.0) == "reachable"
    assert await get_auth_jwks_status(settings, now=120.0) == "reachable"
    assert call_count == 1

    assert await get_auth_jwks_status(settings, now=170.0) == "reachable"
    assert call_count == 2
