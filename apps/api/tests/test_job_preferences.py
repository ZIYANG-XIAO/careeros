"""Integration tests for JobPreferences endpoints."""

import pytest
from conftest import make_integration_client


@pytest.mark.integration
@pytest.mark.asyncio
async def test_get_job_preferences_empty_when_none_exists() -> None:
    async with make_integration_client() as client:
        resp = await client.get("/job-preferences")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] is None
        assert data["target_roles"] == []
        assert data["minimum_salary"] is None
        assert data["security_clearance_interest"] is False


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_job_preferences() -> None:
    async with make_integration_client() as client:
        resp = await client.put(
            "/job-preferences",
            json={
                "target_roles": ["Backend Engineer", "Platform Engineer"],
                "cities": ["Toronto", "Remote"],
                "company_sizes": ["51-200", "201-1000"],
                "industries_include": ["Fintech"],
                "industries_exclude": ["Gambling"],
                "company_blocklist": ["Acme Corp"],
                "minimum_salary": 120000,
                "security_clearance_interest": False,
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["target_roles"] == ["Backend Engineer", "Platform Engineer"]
        assert data["cities"] == ["Toronto", "Remote"]
        assert data["company_sizes"] == ["51-200", "201-1000"]
        assert data["industries_include"] == ["Fintech"]
        assert data["industries_exclude"] == ["Gambling"]
        assert data["company_blocklist"] == ["Acme Corp"]
        assert data["minimum_salary"] == 120000
        assert data["id"] is not None
        assert data["created_at"] is not None

        get_resp = await client.get("/job-preferences")
        assert get_resp.status_code == 200
        assert get_resp.json()["target_roles"] == [
            "Backend Engineer",
            "Platform Engineer",
        ]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_existing_job_preferences_merges_fields() -> None:
    async with make_integration_client() as client:
        await client.put(
            "/job-preferences",
            json={"target_roles": ["Backend Engineer"], "minimum_salary": 100000},
        )

        resp = await client.put(
            "/job-preferences",
            json={"cities": ["Remote"]},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["target_roles"] == ["Backend Engineer"]
        assert data["minimum_salary"] == 100000
        assert data["cities"] == ["Remote"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_job_preferences_ownership_isolation() -> None:
    async with make_integration_client() as client_a:
        await client_a.put(
            "/job-preferences",
            json={"target_roles": ["Only visible to A"]},
        )

        async with make_integration_client() as client_b:
            resp = await client_b.get("/job-preferences")
            assert resp.status_code == 200
            assert resp.json()["id"] is None
            assert resp.json()["target_roles"] == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_blank_list_items_are_dropped_and_trimmed() -> None:
    async with make_integration_client() as client:
        resp = await client.put(
            "/job-preferences",
            json={"target_roles": ["  Backend Engineer  ", "", "   "]},
        )
        assert resp.status_code == 200
        assert resp.json()["target_roles"] == ["Backend Engineer"]


@pytest.mark.integration
@pytest.mark.asyncio
async def test_too_many_list_items_rejected() -> None:
    async with make_integration_client() as client:
        resp = await client.put(
            "/job-preferences",
            json={"target_roles": [f"Role {i}" for i in range(26)]},
        )
        assert resp.status_code == 422
        assert "at most 25 items" in resp.text


@pytest.mark.integration
@pytest.mark.asyncio
async def test_negative_minimum_salary_rejected() -> None:
    async with make_integration_client() as client:
        resp = await client.put("/job-preferences", json={"minimum_salary": -1})
        assert resp.status_code == 422
