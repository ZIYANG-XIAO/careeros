"""Integration tests for Education CRUD endpoints."""

from uuid import uuid4

import pytest
from conftest import make_integration_client


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_education() -> None:
    async with make_integration_client() as client:
        resp = await client.post(
            "/career-brain/educations",
            json={"institution": "MIT", "degree": "BS", "field_of_study": "CS"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["institution"] == "MIT"
        assert data["degree"] == "BS"
        assert data["field_of_study"] == "CS"
        assert "id" in data
        assert "created_at" in data


@pytest.mark.integration
@pytest.mark.asyncio
async def test_list_educations() -> None:
    async with make_integration_client() as client:
        await client.post("/career-brain/educations", json={"institution": "MIT"})
        await client.post("/career-brain/educations", json={"institution": "Stanford"})

        resp = await client.get("/career-brain/educations")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        assert data[0]["institution"] == "MIT"
        assert data[1]["institution"] == "Stanford"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_education() -> None:
    async with make_integration_client() as client:
        create = await client.post("/career-brain/educations", json={"institution": "MIT"})
        edu_id = create.json()["id"]

        resp = await client.patch(
            f"/career-brain/educations/{edu_id}",
            json={"degree": "PhD", "field_of_study": "Physics"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["institution"] == "MIT"
        assert data["degree"] == "PhD"
        assert data["field_of_study"] == "Physics"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_education() -> None:
    async with make_integration_client() as client:
        create = await client.post("/career-brain/educations", json={"institution": "MIT"})
        edu_id = create.json()["id"]

        resp = await client.delete(f"/career-brain/educations/{edu_id}")
        assert resp.status_code == 204

        listing = await client.get("/career-brain/educations")
        assert listing.json() == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_education_not_found_returns_404() -> None:
    async with make_integration_client() as client:
        fake_id = str(uuid4())
        resp = await client.patch(f"/career-brain/educations/{fake_id}", json={"degree": "MS"})
        assert resp.status_code == 404

        resp = await client.delete(f"/career-brain/educations/{fake_id}")
        assert resp.status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_education_ownership_isolation() -> None:
    """User A cannot see or modify User B's educations."""
    async with make_integration_client() as client_a:
        create = await client_a.post("/career-brain/educations", json={"institution": "MIT"})
        edu_id = create.json()["id"]

        async with make_integration_client() as client_b:
            # User B cannot see User A's education
            listing = await client_b.get("/career-brain/educations")
            assert listing.json() == []

            # User B cannot update User A's education
            resp = await client_b.patch(
                f"/career-brain/educations/{edu_id}", json={"degree": "PhD"}
            )
            assert resp.status_code == 404

            # User B cannot delete User A's education
            resp = await client_b.delete(f"/career-brain/educations/{edu_id}")
            assert resp.status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_education_empty_institution_rejected() -> None:
    async with make_integration_client() as client:
        resp = await client.post("/career-brain/educations", json={"institution": "  "})
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_patch_education_null_institution_rejected() -> None:
    """Explicit null for required field institution → 422."""
    async with make_integration_client() as client:
        create = await client.post("/career-brain/educations", json={"institution": "MIT"})
        edu_id = create.json()["id"]

        resp = await client.patch(f"/career-brain/educations/{edu_id}", json={"institution": None})
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_education_institution_too_long_rejected() -> None:
    """Institution exceeding 500 chars → 422."""
    async with make_integration_client() as client:
        resp = await client.post("/career-brain/educations", json={"institution": "X" * 501})
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_education_end_date_before_start_date_rejected() -> None:
    """end_date before start_date → 422 on create."""
    async with make_integration_client() as client:
        resp = await client.post(
            "/career-brain/educations",
            json={
                "institution": "MIT",
                "start_date": "2025-09-01",
                "end_date": "2024-06-01",
            },
        )
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_patch_education_end_date_before_start_date_rejected() -> None:
    """end_date before start_date → 422 on patch (merged values)."""
    async with make_integration_client() as client:
        create = await client.post(
            "/career-brain/educations",
            json={"institution": "MIT", "start_date": "2025-09-01"},
        )
        edu_id = create.json()["id"]

        resp = await client.patch(
            f"/career-brain/educations/{edu_id}", json={"end_date": "2024-06-01"}
        )
        assert resp.status_code == 422
