"""Integration tests for Experience + ExperienceDetail CRUD with evidence."""

import pytest
from conftest import get_test_db_url, make_integration_client
from sqlalchemy import select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from careeros_api.models import CareerEvidence, CareerEvidenceRevision

# ---------------------------------------------------------------------------
# Experience CRUD
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_experience() -> None:
    async with make_integration_client() as client:
        resp = await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["company"] == "Acme"
        assert data["title"] == "Engineer"
        assert data["details"] == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_list_experiences() -> None:
    async with make_integration_client() as client:
        await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        await client.post(
            "/career-brain/experiences",
            json={"company": "Beta", "title": "Manager"},
        )
        resp = await client.get("/career-brain/experiences")
        assert resp.status_code == 200
        assert len(resp.json()) == 2


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_experience() -> None:
    async with make_integration_client() as client:
        create = await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        exp_id = create.json()["id"]

        resp = await client.patch(
            f"/career-brain/experiences/{exp_id}",
            json={"title": "Senior Engineer", "is_current": True},
        )
        assert resp.status_code == 200
        assert resp.json()["title"] == "Senior Engineer"
        assert resp.json()["is_current"] is True


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_experience() -> None:
    async with make_integration_client() as client:
        create = await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        exp_id = create.json()["id"]

        resp = await client.delete(f"/career-brain/experiences/{exp_id}")
        assert resp.status_code == 204

        listing = await client.get("/career-brain/experiences")
        assert listing.json() == []


@pytest.mark.integration
@pytest.mark.asyncio
async def test_experience_ownership_isolation() -> None:
    async with make_integration_client() as client_a:
        create = await client_a.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        exp_id = create.json()["id"]

        async with make_integration_client() as client_b:
            assert (await client_b.get("/career-brain/experiences")).json() == []
            resp = await client_b.patch(
                f"/career-brain/experiences/{exp_id}", json={"title": "Hacked"}
            )
            assert resp.status_code == 404
            resp = await client_b.delete(f"/career-brain/experiences/{exp_id}")
            assert resp.status_code == 404


# ---------------------------------------------------------------------------
# ExperienceDetail CRUD + Evidence
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_detail_creates_evidence() -> None:
    async with make_integration_client() as client:
        exp = await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        exp_id = exp.json()["id"]

        resp = await client.post(
            f"/career-brain/experiences/{exp_id}/details",
            json={"content": "Built the API"},
        )
        assert resp.status_code == 201
        data = resp.json()
        assert data["content"] == "Built the API"
        assert data["evidence"] is not None
        assert data["evidence"]["current_revision_number"] == 1
        assert data["evidence"]["confirmation_status"] == "CONFIRMED"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_detail_appends_revision() -> None:
    async with make_integration_client() as client:
        exp = await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        exp_id = exp.json()["id"]

        detail = await client.post(
            f"/career-brain/experiences/{exp_id}/details",
            json={"content": "Version A"},
        )
        detail_id = detail.json()["id"]

        resp = await client.patch(
            f"/career-brain/experience-details/{detail_id}",
            json={"content": "Version B"},
        )
        assert resp.status_code == 200
        assert resp.json()["content"] == "Version B"
        assert resp.json()["evidence"]["current_revision_number"] == 2


@pytest.mark.integration
@pytest.mark.asyncio
async def test_delete_detail_cleans_up_evidence() -> None:
    async with make_integration_client() as client:
        exp = await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        exp_id = exp.json()["id"]

        detail = await client.post(
            f"/career-brain/experiences/{exp_id}/details",
            json={"content": "Built the API"},
        )
        detail_data = detail.json()
        detail_id = detail_data["id"]
        evidence_id = detail_data["evidence"]["evidence_id"]

        resp = await client.delete(f"/career-brain/experience-details/{detail_id}")
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
async def test_delete_experience_cascades_detail_evidence() -> None:
    """Deleting an experience also removes its details' evidence."""
    async with make_integration_client() as client:
        exp = await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        exp_id = exp.json()["id"]

        d1 = await client.post(
            f"/career-brain/experiences/{exp_id}/details",
            json={"content": "Task 1"},
        )
        d2 = await client.post(
            f"/career-brain/experiences/{exp_id}/details",
            json={"content": "Task 2"},
        )
        ev_id_1 = d1.json()["evidence"]["evidence_id"]
        ev_id_2 = d2.json()["evidence"]["evidence_id"]

        resp = await client.delete(f"/career-brain/experiences/{exp_id}")
        assert resp.status_code == 204

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
async def test_detail_revision_immutability() -> None:
    """Create A → update B → update C.  All three revisions preserved."""
    async with make_integration_client() as client:
        exp = await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        exp_id = exp.json()["id"]

        detail = await client.post(
            f"/career-brain/experiences/{exp_id}/details",
            json={"content": "A"},
        )
        detail_id = detail.json()["id"]
        evidence_id = detail.json()["evidence"]["evidence_id"]

        await client.patch(
            f"/career-brain/experience-details/{detail_id}",
            json={"content": "B"},
        )
        await client.patch(
            f"/career-brain/experience-details/{detail_id}",
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
            assert revisions[0].content == "A"
            assert revisions[1].content == "B"
            assert revisions[2].content == "C"
        await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_detail_ownership_isolation() -> None:
    """User B cannot modify User A's experience details."""
    async with make_integration_client() as client_a:
        exp = await client_a.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        detail = await client_a.post(
            f"/career-brain/experiences/{exp.json()['id']}/details",
            json={"content": "Secret"},
        )
        detail_id = detail.json()["id"]

        async with make_integration_client() as client_b:
            resp = await client_b.patch(
                f"/career-brain/experience-details/{detail_id}",
                json={"content": "Hacked"},
            )
            assert resp.status_code == 404

            resp = await client_b.delete(f"/career-brain/experience-details/{detail_id}")
            assert resp.status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_detail_creation_cross_user_rejected() -> None:
    """User B cannot create a detail on User A's experience."""
    async with make_integration_client() as client_a:
        exp = await client_a.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        exp_id = exp.json()["id"]

        async with make_integration_client() as client_b:
            resp = await client_b.post(
                f"/career-brain/experiences/{exp_id}/details",
                json={"content": "Injected"},
            )
            assert resp.status_code == 404


@pytest.mark.integration
@pytest.mark.asyncio
async def test_patch_experience_null_company_rejected() -> None:
    """Explicit null for required field company → 422."""
    async with make_integration_client() as client:
        create = await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        exp_id = create.json()["id"]

        resp = await client.patch(f"/career-brain/experiences/{exp_id}", json={"company": None})
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_patch_experience_null_title_rejected() -> None:
    """Explicit null for required field title → 422."""
    async with make_integration_client() as client:
        create = await client.post(
            "/career-brain/experiences",
            json={"company": "Acme", "title": "Engineer"},
        )
        exp_id = create.json()["id"]

        resp = await client.patch(f"/career-brain/experiences/{exp_id}", json={"title": None})
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_experience_company_too_long_rejected() -> None:
    """Company exceeding 500 chars → 422."""
    async with make_integration_client() as client:
        resp = await client.post(
            "/career-brain/experiences",
            json={"company": "X" * 501, "title": "Engineer"},
        )
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_experience_end_date_before_start_date_rejected() -> None:
    async with make_integration_client() as client:
        resp = await client.post(
            "/career-brain/experiences",
            json={
                "company": "Acme",
                "title": "Engineer",
                "start_date": "2025-01-01",
                "end_date": "2024-01-01",
            },
        )
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_experience_is_current_with_end_date_rejected() -> None:
    async with make_integration_client() as client:
        resp = await client.post(
            "/career-brain/experiences",
            json={
                "company": "Acme",
                "title": "Engineer",
                "is_current": True,
                "end_date": "2025-06-01",
            },
        )
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_patch_experience_is_current_with_existing_end_date_rejected() -> None:
    """Setting is_current=true when end_date is already set → 422."""
    async with make_integration_client() as client:
        create = await client.post(
            "/career-brain/experiences",
            json={
                "company": "Acme",
                "title": "Engineer",
                "end_date": "2025-06-01",
            },
        )
        exp_id = create.json()["id"]

        resp = await client.patch(f"/career-brain/experiences/{exp_id}", json={"is_current": True})
        assert resp.status_code == 422
