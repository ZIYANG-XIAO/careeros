from uuid import UUID

from conftest import make_test_settings
from fastapi import status
from fastapi.testclient import TestClient

from careeros_api.main import create_app

TEST_USER_ID = UUID("00000000-0000-4000-8000-000000000001")


def test_get_me_returns_authenticated_user(authenticated_client: TestClient) -> None:
    response = authenticated_client.get("/me")

    assert response.status_code == status.HTTP_200_OK
    data = response.json()
    assert data["id"] == str(TEST_USER_ID)
    assert data["email"] == "test@example.com"
    assert "created_at" in data


def test_get_me_rejects_unauthenticated_request() -> None:
    application = create_app(make_test_settings())

    with TestClient(application) as client:
        response = client.get("/me")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
