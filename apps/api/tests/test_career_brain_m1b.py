"""Integration tests for the expanded GET /career-brain endpoint (M1B)."""

import pytest
from conftest import make_integration_client


@pytest.mark.integration
@pytest.mark.asyncio
async def test_career_brain_includes_entities() -> None:
    """GET /career-brain returns nested educations, experiences, projects, skills."""
    async with make_integration_client() as client:
        # Seed data
        await client.post("/career-brain/educations", json={"institution": "MIT"})

        exp = await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        await client.post(
            f"/career-brain/experiences/{exp.json()['id']}/details",
            json={"content": "Built API"},
        )

        proj = await client.post("/career-brain/projects", json={"name": "CareerOS"})
        await client.post(
            f"/career-brain/projects/{proj.json()['id']}/details",
            json={"content": "Frontend work"},
        )

        await client.post("/career-brain/skills", json={"name": "Python"})

        # Fetch career brain
        resp = await client.get("/career-brain")
        assert resp.status_code == 200
        data = resp.json()

        assert len(data["educations"]) == 1
        assert data["educations"][0]["institution"] == "MIT"

        assert len(data["experiences"]) == 1
        assert data["experiences"][0]["company"] == "Acme"
        assert len(data["experiences"][0]["details"]) == 1
        assert data["experiences"][0]["details"][0]["content"] == "Built API"
        assert data["experiences"][0]["details"][0]["evidence"] is not None

        assert len(data["projects"]) == 1
        assert data["projects"][0]["name"] == "CareerOS"
        assert len(data["projects"][0]["details"]) == 1

        assert len(data["skills"]) == 1
        assert data["skills"][0]["name"] == "Python"
        assert data["skills"][0]["evidence"] is not None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_career_brain_empty_when_no_entities() -> None:
    async with make_integration_client() as client:
        resp = await client.get("/career-brain")
        assert resp.status_code == 200
        data = resp.json()
        assert data["educations"] == []
        assert data["experiences"] == []
        assert data["projects"] == []
        assert data["skills"] == []
