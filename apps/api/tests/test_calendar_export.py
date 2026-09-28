from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from conftest import make_integration_client
from test_application_memory import external_payload

from careeros_api.calendar_export import CalendarEvent, build_ics


def test_build_ics_escapes_text_and_folds_long_lines() -> None:
    starts = datetime(2026, 10, 1, 9, 30, tzinfo=UTC)
    ics = build_ics(
        [
            CalendarEvent(
                uid=uuid4(),
                kind="INTERVIEW",
                title="Onsite, round 2; bring laptop",
                company="Acme",
                role="Engineer",
                body="Line one\nLine two " + "很长的说明" * 20,
                starts_at=starts,
            )
        ],
        now=starts,
    )
    assert ics.startswith("BEGIN:VCALENDAR\r\n")
    assert ics.endswith("END:VCALENDAR\r\n")
    assert "SUMMARY:Interview: Onsite\\, round 2\; bring laptop" in ics
    assert "DTSTART:20261001T093000Z" in ics
    assert "DTEND:20261001T103000Z" in ics
    assert "Line one\\nLine two" in ics
    assert all(len(line.encode()) <= 75 for line in ics.split("\r\n"))


@pytest.mark.integration
@pytest.mark.asyncio
async def test_calendar_includes_open_scheduled_items_for_owner_only() -> None:
    now = datetime.now(UTC)
    async with make_integration_client() as client:
        application = (
            await client.post("/applications", json=external_payload(company="Calendar Co"))
        ).json()

        async def add(kind: str, title: str, when: datetime) -> None:
            response = await client.post(
                f"/applications/{application['id']}/activities",
                json={
                    "idempotency_key": str(uuid4()),
                    "activity_type": kind,
                    "title": title,
                    "scheduled_at": when.isoformat(),
                },
            )
            assert response.status_code == 201, response.text

        await add("INTERVIEW", "Tech screen", now + timedelta(days=2))
        await add("FOLLOW_UP", "Ping recruiter", now + timedelta(days=5))
        await add("FOLLOW_UP", "Ancient", now - timedelta(days=90))
        await client.post(
            f"/applications/{application['id']}/activities",
            json={"idempotency_key": str(uuid4()), "activity_type": "NOTE", "title": "Note"},
        )

        response = await client.get("/calendar/activities.ics")
        assert response.status_code == 200
        assert response.headers["content-type"].startswith("text/calendar")
        body = response.text
        assert body.count("BEGIN:VEVENT") == 2
        assert "Interview: Tech screen" in body
        assert "Follow-up: Ping recruiter" in body
        assert "Ancient" not in body
        assert "Calendar Co" in body

        async with make_integration_client(user_id=uuid4(), brain_id=uuid4()) as other:
            assert "BEGIN:VEVENT" not in (await other.get("/calendar/activities.ics")).text
