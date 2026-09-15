"""Integration tests for Project + ProjectDetail CRUD with evidence."""

import pytest
from conftest import get_test_db_url, make_integration_client
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from careeros_api.models import CareerEvidence, CareerEvidenceRevision

# ---------------------------------------------------------------------------
# Project CRUD
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_project() -> None:
    async with make_integration_client() as client:
        resp = await client.post(
            "/career-brain/projects",
            json={"name": "CareerOS", "description": "AI career tool"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["name"] == "CareerOS"
        assert data["description"] == "AI career tool"
        assert data["details"] == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_list_projects() -> None:
    async with make_integration_client() as client:
        await client.post("/career-brain/projects", json={"name": "Alpha"})
        await client.post("/career-brain/projects", json={"name": "Beta"})
        resp = await client.get("/career-brain/projects")
        assert resp.status_code == 200
        assert len(resp.json()) == 2


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_project() -> None:
    async with make_integration_client() as client:
        create = await client.post("/career-brain/projects", json={"name": "Alpha"})
        proj_id = create.json()["id"]

        resp = await client.patch(
            f"/career-brain/projects/{proj_id}",
            json={"name": "Alpha v2", "url": "https://alpha.dev"},
        )
        assert resp.status_code == 200
        assert resp.json()["name"] == "Alpha v2"
        assert resp.json()["url"] == "https://alpha.dev"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_project() -> None:
    async with make_integration_client() as client:
        create = await client.post("/career-brain/projects", json={"name": "Alpha"})
        proj_id = create.json()["id"]

        resp = await client.delete(f"/career-brain/projects/{proj_id}")
        assert resp.status_code == 204

        listing = await client.get("/career-brain/projects")
        assert listing.json() == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_project_ownership_isolation() -> None:
    async with make_integration_client() as client_a:
        create = await client_a.post("/career-brain/projects", json={"name": "Secret"})
        proj_id = create.json()["id"]

        async with make_integration_client() as client_b:
            assert (await client_b.get("/career-brain/projects")).json() == []
            resp = await client_b.patch(
                f"/career-brain/projects/{proj_id}", json={"name": "Hacked"}
            )
            assert resp.status_code == 404
            resp = await client_b.delete(f"/career-brain/projects/{proj_id}")
            assert resp.status_code == 404


# ---------------------------------------------------------------------------
# ProjectDetail CRUD + Evidence
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_project_detail_creates_evidence() -> None:
    async with make_integration_client() as client:
        proj = await client.post("/career-brain/projects", json={"name": "Alpha"})
        proj_id = proj.json()["id"]

        resp = await client.post(
            f"/career-brain/projects/{proj_id}/details",
            json={"content": "Built the frontend"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["content"] == "Built the frontend"
        assert data["evidence"] is not None
        assert data["evidence"]["current_revision_number"] == 1


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_project_detail_appends_revision() -> None:
    async with make_integration_client() as client:
        proj = await client.post("/career-brain/projects", json={"name": "Alpha"})
        proj_id = proj.json()["id"]

        detail = await client.post(
            f"/career-brain/projects/{proj_id}/details",
            json={"content": "Version A"},
        )
        detail_id = detail.json()["id"]

        resp = await client.patch(
            f"/career-brain/project-details/{detail_id}",
            json={"content": "Version B"},
        )
        assert resp.status_code == 200
        assert resp.json()["evidence"]["current_revision_number"] == 2


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_project_detail_cleans_up_evidence() -> None:
    async with make_integration_client() as client:
        proj = await client.post("/career-brain/projects", json={"name": "Alpha"})
        proj_id = proj.json()["id"]

        detail = await client.post(
            f"/career-brain/projects/{proj_id}/details",
            json={"content": "Detail"},
        )
        evidence_id = detail.json()["evidence"]["evidence_id"]
        detail_id = detail.json()["id"]

        resp = await client.delete(f"/career-brain/project-details/{detail_id}")
        assert resp.status_code == 204

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
async def test_delete_project_cascades_detail_evidence() -> None:
    async with make_integration_client() as client:
        proj = await client.post("/career-brain/projects", json={"name": "Alpha"})
        proj_id = proj.json()["id"]

        d1 = await client.post(
            f"/career-brain/projects/{proj_id}/details",
            json={"content": "Task 1"},
        )
        d2 = await client.post(
            f"/career-brain/projects/{proj_id}/details",
            json={"content": "Task 2"},
        )
        ev_id_1 = d1.json()["evidence"]["evidence_id"]
        ev_id_2 = d2.json()["evidence"]["evidence_id"]

        await client.delete(f"/career-brain/projects/{proj_id}")

        engine = create_async_engine(get_test_db_url(), pool_pre_ping=True)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            for eid in (ev_id_1, ev_id_2):
                result = await session.execute(
                    select(CareerEvidence).where(CareerEvidence.id == eid)
                )
                assert result.scalar_one_or_none() is None
        await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_project_detail_revision_immutability() -> None:
    async with make_integration_client() as client:
        proj = await client.post("/career-brain/projects", json={"name": "Alpha"})
        proj_id = proj.json()["id"]

        detail = await client.post(
            f"/career-brain/projects/{proj_id}/details",
            json={"content": "A"},
        )
        detail_id = detail.json()["id"]
        evidence_id = detail.json()["evidence"]["evidence_id"]

        await client.patch(
            f"/career-brain/project-details/{detail_id}",
            json={"content": "B"},
        )
        await client.patch(
            f"/career-brain/project-details/{detail_id}",
            json={"content": "C"},
        )

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
            assert [r.content for r in revisions] == ["A", "B", "C"]
        await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_project_detail_ownership_isolation() -> None:
    async with make_integration_client() as client_a:
        proj = await client_a.post("/career-brain/projects", json={"name": "Secret"})
        detail = await client_a.post(
            f"/career-brain/projects/{proj.json()['id']}/details",
            json={"content": "Private"},
        )
        detail_id = detail.json()["id"]

        async with make_integration_client() as client_b:
            resp = await client_b.patch(
                f"/career-brain/project-details/{detail_id}",
                json={"content": "Hacked"},
            )
            assert resp.status_code == 404
            resp = await client_b.delete(f"/career-brain/project-details/{detail_id}")
            assert resp.status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_detail_creation_cross_user_rejected() -> None:
    """User B cannot create a detail on User A's project."""
    async with make_integration_client() as client_a:
        proj = await client_a.post("/career-brain/projects", json={"name": "Secret"})
        proj_id = proj.json()["id"]

        async with make_integration_client() as client_b:
            resp = await client_b.post(
                f"/career-brain/projects/{proj_id}/details",
                json={"content": "Injected"},
            )
            assert resp.status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_patch_project_null_name_rejected() -> None:
    """Explicit null for required field name → 422."""
    async with make_integration_client() as client:
        create = await client.post("/career-brain/projects", json={"name": "Alpha"})
        proj_id = create.json()["id"]

        resp = await client.patch(f"/career-brain/projects/{proj_id}", json={"name": None})
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_project_name_too_long_rejected() -> None:
    """Name exceeding 500 chars → 422."""
    async with make_integration_client() as client:
        resp = await client.post("/career-brain/projects", json={"name": "X" * 501})
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_project_end_date_before_start_date_rejected() -> None:
    async with make_integration_client() as client:
        resp = await client.post(
            "/career-brain/projects",
            json={
                "name": "Alpha",
                "start_date": "2025-01-01",
                "end_date": "2024-01-01",
            },
        )
        assert resp.status_code == 422
