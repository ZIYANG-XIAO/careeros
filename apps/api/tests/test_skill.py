"""Integration tests for Skill CRUD endpoints with evidence lifecycle."""

from uuid import uuid4

import pytest
from conftest import get_test_db_url, make_integration_client
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from careeros_api.models import CareerEvidence, CareerEvidenceRevision


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_skill_creates_evidence() -> None:
    async with make_integration_client() as client:
        resp = await client.post("/career-brain/skills", json={"name": "Python"})
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "Python"
        assert data["evidence"] is not None
        assert data["evidence"]["current_revision_number"] == 1
        assert data["evidence"]["confirmation_status"] == "CONFIRMED"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_skill_defaults_preferred_to_false() -> None:
    async with make_integration_client() as client:
        resp = await client.post("/career-brain/skills", json={"name": "Python"})
        assert resp.status_code == 201
        assert resp.json()["preferred"] is False


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_skill_preferred_true() -> None:
    async with make_integration_client() as client:
        resp = await client.post("/career-brain/skills", json={"name": "Python", "preferred": True})
        assert resp.status_code == 201
        assert resp.json()["preferred"] is True


@pytest.mark.integration
@pytest.mark.asyncio
async def test_toggle_skill_preferred_does_not_append_evidence_revision() -> None:
    async with make_integration_client() as client:
        create = await client.post("/career-brain/skills", json={"name": "Python"})
        skill_id = create.json()["id"]
        assert create.json()["evidence"]["current_revision_number"] == 1

        toggled = await client.patch(
            f"/career-brain/skills/{skill_id}",
            json={"name": "Python", "preferred": True},
        )
        assert toggled.status_code == 200
        data = toggled.json()
        assert data["preferred"] is True
        assert data["name"] == "Python"
        assert data["evidence"]["current_revision_number"] == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_list_skills() -> None:
    async with make_integration_client() as client:
        await client.post("/career-brain/skills", json={"name": "Python"})
        await client.post("/career-brain/skills", json={"name": "Rust"})

        resp = await client.get("/career-brain/skills")
        assert resp.status_code == 200
        data = resp.json()
        assert len(data) == 2
        names = [s["name"] for s in data]
        assert "Python" in names
        assert "Rust" in names


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_skill_appends_revision() -> None:
    async with make_integration_client() as client:
        create = await client.post("/career-brain/skills", json={"name": "Python"})
        skill_id = create.json()["id"]

        resp = await client.patch(f"/career-brain/skills/{skill_id}", json={"name": "Python 3"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["name"] == "Python 3"
        assert data["evidence"]["current_revision_number"] == 2


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_skill_cleans_up_evidence() -> None:
    async with make_integration_client() as client:
        create = await client.post("/career-brain/skills", json={"name": "Go"})
        skill_data = create.json()
        skill_id = skill_data["id"]
        evidence_id = skill_data["evidence"]["evidence_id"]

        resp = await client.delete(f"/career-brain/skills/{skill_id}")
        assert resp.status_code == 204

        # Verify evidence is gone from DB.
        engine = create_async_engine(get_test_db_url(), pool_pre_ping=True)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            result = await session.execute(
                select(CareerEvidence).where(CareerEvidence.id == evidence_id)
            )
            assert result.scalar_one_or_none() is None
        await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_skill_ownership_isolation() -> None:
    async with make_integration_client() as client_a:
        create = await client_a.post("/career-brain/skills", json={"name": "Python"})
        skill_id = create.json()["id"]

        async with make_integration_client() as client_b:
            listing = await client_b.get("/career-brain/skills")
            assert listing.json() == []

            resp = await client_b.patch(f"/career-brain/skills/{skill_id}", json={"name": "Hacked"})
            assert resp.status_code == 404

            resp = await client_b.delete(f"/career-brain/skills/{skill_id}")
            assert resp.status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_skill_revision_immutability() -> None:
    """Create A → update B → update C.  All three revisions must be preserved."""
    async with make_integration_client() as client:
        create = await client.post("/career-brain/skills", json={"name": "A"})
        evidence_id = create.json()["evidence"]["evidence_id"]

        skill_id = create.json()["id"]
        await client.patch(f"/career-brain/skills/{skill_id}", json={"name": "B"})
        await client.patch(f"/career-brain/skills/{skill_id}", json={"name": "C"})

        # Query DB directly for all revisions.
        engine = create_async_engine(get_test_db_url(), pool_pre_ping=True)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            result = await session.execute(
                select(CareerEvidenceRevision)
                .where(CareerEvidenceRevision.evidence_id == evidence_id)
                .order_by(CareerEvidenceRevision.revision_number)
            )
            revisions = result.scalars().all()
            assert len(revisions) == 3
            assert revisions[0].content == "A"
            assert revisions[0].revision_number == 1
            assert revisions[1].content == "B"
            assert revisions[1].revision_number == 2
            assert revisions[2].content == "C"
            assert revisions[2].revision_number == 3
        await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_skill_empty_name_rejected() -> None:
    async with make_integration_client() as client:
        resp = await client.post("/career-brain/skills", json={"name": "  "})
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_skill_name_too_long_rejected() -> None:
    """Name exceeding 500 chars → 422."""
    async with make_integration_client() as client:
        resp = await client.post("/career-brain/skills", json={"name": "X" * 501})
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_skill_not_found_returns_404() -> None:
    async with make_integration_client() as client:
        fake_id = str(uuid4())
        resp = await client.patch(f"/career-brain/skills/{fake_id}", json={"name": "X"})
        assert resp.status_code == 404
