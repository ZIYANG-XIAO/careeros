from fastapi import status
from fastapi.testclient import TestClient
from pytest import MonkeyPatch

from careeros_api.config import Settings
from careeros_api.health import get_database_status
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
