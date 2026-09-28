from uuid import uuid4

import pytest
from conftest import make_integration_client

pytestmark = pytest.mark.integration


def goal_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "name": "Canada backend search",
        "market": "NORTH_AMERICA",
        "country_codes": ["CA"],
        "target_roles": ["Backend Engineer"],
        "cities": ["Toronto", "Vancouver"],
        "workplace_types": ["HYBRID", "REMOTE"],
        "employment_types": ["FULL_TIME"],
        "minimum_salary": 130000,
        "salary_currency": "CAD",
    }
    payload.update(overrides)
    return payload


@pytest.mark.asyncio
async def test_first_goal_becomes_active_and_second_can_be_activated() -> None:
    async with make_integration_client() as client:
        first = await client.post("/job-search-goals", json=goal_payload())
        assert first.status_code == 201
        assert first.json()["is_active"] is True

        second = await client.post(
            "/job-search-goals",
            json=goal_payload(
                name="Shanghai product search",
                market="CHINA",
                country_codes=["CN"],
                target_roles=["产品经理"],
                cities=["上海"],
                minimum_salary=35000,
                salary_currency="CNY",
                is_active=True,
            ),
        )
        assert second.status_code == 201
        assert second.json()["is_active"] is True

        response = await client.get("/job-search-goals")
        assert response.status_code == 200
        goals = response.json()
        assert [goal["name"] for goal in goals] == [
            "Shanghai product search",
            "Canada backend search",
        ]
        assert [goal["is_active"] for goal in goals] == [True, False]


@pytest.mark.asyncio
async def test_goal_market_country_and_salary_are_validated() -> None:
    async with make_integration_client() as client:
        wrong_country = await client.post(
            "/job-search-goals",
            json=goal_payload(market="CHINA", country_codes=["US"]),
        )
        assert wrong_country.status_code == 422

        missing_currency = await client.post(
            "/job-search-goals",
            json=goal_payload(salary_currency=None),
        )
        assert missing_currency.status_code == 422


@pytest.mark.asyncio
async def test_goal_update_validates_complete_market_state() -> None:
    async with make_integration_client() as client:
        created = await client.post("/job-search-goals", json=goal_payload())
        goal_id = created.json()["id"]

        invalid = await client.patch(f"/job-search-goals/{goal_id}", json={"market": "CHINA"})
        assert invalid.status_code == 422

        updated = await client.patch(
            f"/job-search-goals/{goal_id}",
            json={
                "market": "CHINA",
                "country_codes": ["CN"],
                "name": "上海后端岗位",
                "salary_currency": "CNY",
            },
        )
        assert updated.status_code == 200
        assert updated.json()["market"] == "CHINA"
        assert updated.json()["name"] == "上海后端岗位"


@pytest.mark.asyncio
async def test_goal_ownership_isolation() -> None:
    owner_id = uuid4()
    async with make_integration_client(user_id=owner_id) as owner:
        created = await owner.post("/job-search-goals", json=goal_payload())
        goal_id = created.json()["id"]

        async with make_integration_client() as other:
            listed = await other.get("/job-search-goals")
            assert listed.status_code == 200
            assert listed.json() == []

            updated = await other.patch(f"/job-search-goals/{goal_id}", json={"name": "Stolen"})
            assert updated.status_code == 404
