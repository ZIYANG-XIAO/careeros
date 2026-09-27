"""Integration tests for the ApplicationStatusHistory timeline."""

from uuid import uuid4

import pytest
from conftest import make_integration_client, make_test_settings
from fastapi.testclient import TestClient

from careeros_api.main import create_app

pytestmark = pytest.mark.integration


def external_payload(*, status: str = "PREPARING") -> dict[str, object]:
    return {
        "idempotency_key": str(uuid4()),
        "origin": "EXTERNAL_PAGE",
        "company": "History Corp",
        "role": "Platform Engineer",
        "application_url": "https://jobs.example.com/platform/apply",
        "source": "company_site",
        "status": status,
        "answers": [],
    }


@pytest.mark.asyncio
async def test_create_records_initial_history_entry() -> None:
    async with make_integration_client() as client:
        created = await client.post("/applications", json=external_payload(status="APPLIED"))
        application_id = created.json()["id"]

        history = await client.get(f"/applications/{application_id}/status-history")
        assert history.status_code == 200
        assert history.json() == [
            {
                "from_status": None,
                "to_status": "APPLIED",
                "changed_at": history.json()[0]["changed_at"],
            }
        ]


@pytest.mark.asyncio
async def test_status_update_appends_history_entry() -> None:
    async with make_integration_client() as client:
        created = await client.post("/applications", json=external_payload())
        application_id = created.json()["id"]

        await client.patch(
            f"/applications/{application_id}/status",
            json={"idempotency_key": str(uuid4()), "status": "APPLIED"},
        )
        await client.patch(
            f"/applications/{application_id}/status",
            json={"idempotency_key": str(uuid4()), "status": "INTERVIEW"},
        )

        history = (await client.get(f"/applications/{application_id}/status-history")).json()
        assert [(entry["from_status"], entry["to_status"]) for entry in history] == [
            (None, "PREPARING"),
            ("PREPARING", "APPLIED"),
            ("APPLIED", "INTERVIEW"),
        ]
        # Oldest first.
        assert history[0]["changed_at"] < history[1]["changed_at"] < history[2]["changed_at"]


@pytest.mark.asyncio
async def test_idempotent_status_retry_does_not_duplicate_history() -> None:
    async with make_integration_client() as client:
        created = await client.post("/applications", json=external_payload())
        application_id = created.json()["id"]
        update_payload = {"idempotency_key": str(uuid4()), "status": "APPLIED"}

        await client.patch(f"/applications/{application_id}/status", json=update_payload)
        await client.patch(f"/applications/{application_id}/status", json=update_payload)

        history = (await client.get(f"/applications/{application_id}/status-history")).json()
        assert [(entry["from_status"], entry["to_status"]) for entry in history] == [
            (None, "PREPARING"),
            ("PREPARING", "APPLIED"),
        ]


@pytest.mark.asyncio
async def test_no_op_status_update_does_not_append_history() -> None:
    async with make_integration_client() as client:
        created = await client.post("/applications", json=external_payload(status="APPLIED"))
        application_id = created.json()["id"]

        await client.patch(
            f"/applications/{application_id}/status",
            json={"idempotency_key": str(uuid4()), "status": "APPLIED"},
        )

        history = (await client.get(f"/applications/{application_id}/status-history")).json()
        assert [(entry["from_status"], entry["to_status"]) for entry in history] == [
            (None, "APPLIED"),
        ]


@pytest.mark.asyncio
async def test_submission_auto_transition_is_recorded() -> None:
    async with make_integration_client() as client:
        created = await client.post("/applications", json=external_payload())
        application_id = created.json()["id"]

        await client.post(
            f"/applications/{application_id}/submission",
            json={"idempotency_key": str(uuid4()), "answers": []},
        )

        history = (await client.get(f"/applications/{application_id}/status-history")).json()
        assert [(entry["from_status"], entry["to_status"]) for entry in history] == [
            (None, "PREPARING"),
            ("PREPARING", "APPLIED"),
        ]


@pytest.mark.asyncio
async def test_status_history_ownership_isolation() -> None:
    async with make_integration_client() as client_a:
        created = await client_a.post("/applications", json=external_payload())
        application_id = created.json()["id"]

        async with make_integration_client() as client_b:
            resp = await client_b.get(f"/applications/{application_id}/status-history")
            assert resp.status_code == 404


def test_status_history_requires_authentication() -> None:
    application = create_app(make_test_settings())
    with TestClient(application) as client:
        assert client.get(f"/applications/{uuid4()}/status-history").status_code == 401
