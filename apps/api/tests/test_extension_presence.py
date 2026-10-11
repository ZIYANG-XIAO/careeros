"""Integration tests for the extension presence endpoints."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from conftest import make_integration_client


@pytest.mark.integration
@pytest.mark.asyncio
async def test_presence_is_unknown_until_the_extension_reports() -> None:
    async with make_integration_client() as client:
        resp = await client.get("/me/extension-presence")
        assert resp.status_code == 200
        assert resp.json() == {"last_seen_at": None, "build_version": None}


@pytest.mark.integration
@pytest.mark.asyncio
async def test_report_records_server_time_and_overwrites_previous_report() -> None:
    async with make_integration_client() as client:
        before = datetime.now(UTC)
        first = await client.put("/me/extension-presence", json={"build_version": "abc1234"})
        assert first.status_code == 200

        second = await client.put("/me/extension-presence", json={"build_version": "def5678"})
        assert second.status_code == 200

        data = (await client.get("/me/extension-presence")).json()
        assert data["build_version"] == "def5678"
        seen = datetime.fromisoformat(data["last_seen_at"])
        assert before - timedelta(seconds=5) <= seen <= datetime.now(UTC) + timedelta(seconds=5)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_report_rejects_client_supplied_time_and_bad_versions() -> None:
    async with make_integration_client() as client:
        for body in (
            {"build_version": "abc", "last_seen_at": "2000-01-01T00:00:00Z"},
            {"build_version": ""},
            {"build_version": "has spaces"},
            {"build_version": "x" * 65},
            {},
        ):
            resp = await client.put("/me/extension-presence", json=body)
            assert resp.status_code == 422, body


@pytest.mark.integration
@pytest.mark.asyncio
async def test_presence_is_owner_scoped_and_exported() -> None:
    async with make_integration_client() as client_a:
        await client_a.put("/me/extension-presence", json={"build_version": "abc1234"})
        exported = (await client_a.get("/me/export")).json()
        assert exported["extension_presence"][0]["build_version"] == "abc1234"

        async with make_integration_client(user_id=uuid4(), brain_id=uuid4()) as client_b:
            resp = await client_b.get("/me/extension-presence")
            assert resp.json() == {"last_seen_at": None, "build_version": None}
            assert (await client_b.get("/me/export")).json()["extension_presence"] == []
