"""Integration coverage for user-owned Application activities."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from conftest import make_integration_client

pytestmark = pytest.mark.integration


def application_payload() -> dict[str, object]:
    return {
        "idempotency_key": str(uuid4()),
        "origin": "EXTERNAL_PAGE",
        "company": "Activity Corp",
        "role": "Platform Engineer",
        "source": "company_site",
        "status": "APPLIED",
        "answers": [],
    }


@pytest.mark.asyncio
async def test_activity_lifecycle_and_upcoming_feed() -> None:
    async with make_integration_client() as client:
        application_id = (await client.post("/applications", json=application_payload())).json()[
            "id"
        ]
        note = await client.post(
            f"/applications/{application_id}/activities",
            json={
                "idempotency_key": str(uuid4()),
                "activity_type": "NOTE",
                "title": "Recruiter context",
                "body": "Met at the data platform meetup.",
            },
        )
        assert note.status_code == 201
        assert note.json()["scheduled_at"] is None

        follow_up_at = datetime.now(UTC) + timedelta(days=2)
        follow_up = await client.post(
            f"/applications/{application_id}/activities",
            json={
                "idempotency_key": str(uuid4()),
                "activity_type": "FOLLOW_UP",
                "title": "Follow up with recruiter",
                "scheduled_at": follow_up_at.isoformat(),
            },
        )
        assert follow_up.status_code == 201

        interview_at = datetime.now(UTC) + timedelta(days=4)
        interview = await client.post(
            f"/applications/{application_id}/activities",
            json={
                "idempotency_key": str(uuid4()),
                "activity_type": "INTERVIEW",
                "title": "Technical interview",
                "body": "System design round",
                "scheduled_at": interview_at.isoformat(),
            },
        )
        assert interview.status_code == 201

        activities = await client.get(f"/applications/{application_id}/activities")
        assert activities.status_code == 200
        assert {item["activity_type"] for item in activities.json()} == {
            "NOTE",
            "FOLLOW_UP",
            "INTERVIEW",
        }

        upcoming = await client.get("/applications/activities/upcoming")
        assert [item["activity_type"] for item in upcoming.json()] == [
            "FOLLOW_UP",
            "INTERVIEW",
        ]

        completed = await client.patch(
            f"/applications/{application_id}/activities/{follow_up.json()['id']}",
            json={"completed": True},
        )
        assert completed.status_code == 200
        assert completed.json()["completed_at"] is not None

        upcoming_after = await client.get("/applications/activities/upcoming")
        assert [item["activity_type"] for item in upcoming_after.json()] == ["INTERVIEW"]


@pytest.mark.asyncio
async def test_activity_creation_is_idempotent_and_validated() -> None:
    async with make_integration_client() as client:
        application_id = (await client.post("/applications", json=application_payload())).json()[
            "id"
        ]
        key = str(uuid4())
        payload = {
            "idempotency_key": key,
            "activity_type": "NOTE",
            "title": "Hiring manager note",
        }
        created = await client.post(f"/applications/{application_id}/activities", json=payload)
        retried = await client.post(f"/applications/{application_id}/activities", json=payload)
        conflict = await client.post(
            f"/applications/{application_id}/activities",
            json={**payload, "title": "Different note"},
        )
        invalid = await client.post(
            f"/applications/{application_id}/activities",
            json={
                "idempotency_key": str(uuid4()),
                "activity_type": "NOTE",
                "title": "Cannot schedule a note",
                "scheduled_at": datetime.now(UTC).isoformat(),
            },
        )

        assert created.status_code == 201
        assert retried.status_code == 200
        assert retried.json()["id"] == created.json()["id"]
        assert conflict.status_code == 409
        assert invalid.status_code == 422

        activities = (await client.get(f"/applications/{application_id}/activities")).json()
        assert len(activities) == 1


@pytest.mark.asyncio
async def test_activity_ownership_isolation() -> None:
    async with make_integration_client() as client_a:
        application_id = (await client_a.post("/applications", json=application_payload())).json()[
            "id"
        ]

        async with make_integration_client() as client_b:
            listed = await client_b.get(f"/applications/{application_id}/activities")
            created = await client_b.post(
                f"/applications/{application_id}/activities",
                json={
                    "idempotency_key": str(uuid4()),
                    "activity_type": "NOTE",
                    "title": "Private note",
                },
            )
            assert listed.status_code == 404
            assert created.status_code == 404
