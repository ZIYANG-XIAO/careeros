from conftest import make_test_settings
from fastapi import status
from fastapi.testclient import TestClient

from careeros_api.main import create_app


def test_get_career_brain_rejects_unauthenticated_request() -> None:
    application = create_app(make_test_settings())

    with TestClient(application) as client:
        response = client.get("/career-brain")

    assert response.status_code == status.HTTP_401_UNAUTHORIZED
