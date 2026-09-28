"""Delete/edit of owned resources, full account export, and account deletion."""

from pathlib import Path
from uuid import uuid4

import pytest
from conftest import get_test_db_url, make_integration_client
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from test_application_memory import (
    EmptyResumeParser,
    FakeJobParser,
    external_payload,
    job_payload,
    resume_docx,
)

from careeros_api.models import CareerBrain, User

pytestmark = pytest.mark.integration


async def upload_resume(client, name: str = "resume.docx") -> dict[str, str]:  # type: ignore[no-untyped-def]
    response = await client.post(
        "/resume-imports",
        files={"file": (name, resume_docx(), "application/octet-stream")},
    )
    assert response.status_code == 201, response.text
    return response.json()  # type: ignore[no-any-return]


@pytest.mark.asyncio
async def test_job_can_be_edited_and_deleted_while_applications_survive() -> None:
    async with make_integration_client(job_parser=FakeJobParser()) as client:
        job = (await client.post("/jobs", json=job_payload())).json()
        edited = await client.patch(
            f"/jobs/{job['id']}",
            json={"title": "Staff Engineer", "market": "CHINA", "country_code": "CN"},
        )
        assert edited.status_code == 200, edited.text
        assert edited.json()["title"] == "Staff Engineer"
        assert edited.json()["country_code"] == "CN"
        assert (
            await client.patch(f"/jobs/{job['id']}", json={"country_code": "US"})
        ).status_code == 422
        assert (await client.patch(f"/jobs/{job['id']}", json={"title": None})).status_code == 422

        application = await client.post(
            "/applications",
            json={**external_payload(), "origin": "CAREEROS_JOB", "job_id": job["id"]},
        )
        assert application.status_code == 201, application.text

        assert (await client.delete(f"/jobs/{job['id']}")).status_code == 204
        assert (await client.get(f"/jobs/{job['id']}")).status_code == 404
        kept = await client.get(f"/applications/{application.json()['id']}")
        assert kept.status_code == 200
        assert kept.json()["job_id"] is None
        assert kept.json()["company"]


@pytest.mark.asyncio
async def test_application_delete_is_owner_scoped() -> None:
    async with make_integration_client() as owner:
        created = (await owner.post("/applications", json=external_payload())).json()
        async with make_integration_client(user_id=uuid4(), brain_id=uuid4()) as other:
            assert (await other.delete(f"/applications/{created['id']}")).status_code == 404
            assert (await other.delete(f"/jobs/{uuid4()}")).status_code == 404
        assert (await owner.delete(f"/applications/{created['id']}")).status_code == 204
        assert (await owner.get(f"/applications/{created['id']}")).status_code == 404


@pytest.mark.asyncio
async def test_resume_delete_refuses_when_an_application_recorded_it(tmp_path: Path) -> None:
    async with make_integration_client(
        resume_parser=EmptyResumeParser(), resume_storage_dir=str(tmp_path)
    ) as client:
        used = await upload_resume(client, "used.docx")
        unused = await upload_resume(client, "unused.docx")
        assert len(list(tmp_path.iterdir())) == 2
        application = await client.post(
            "/applications",
            json={**external_payload(), "resume_version_id": used["resume_version_id"]},
        )
        assert application.status_code == 201, application.text

        refused = await client.delete(f"/resumes/{used['resume_id']}")
        assert refused.status_code == 409
        assert refused.json()["detail"]["code"] == "RESUME_IN_USE"

        assert (await client.delete(f"/resumes/{unused['resume_id']}")).status_code == 204
        assert (await client.get(f"/resumes/{unused['resume_id']}")).status_code == 404
        assert len(list(tmp_path.iterdir())) == 1


@pytest.mark.asyncio
async def test_export_contains_owned_data_only(tmp_path: Path) -> None:
    async with make_integration_client(
        resume_parser=EmptyResumeParser(),
        job_parser=FakeJobParser(),
        resume_storage_dir=str(tmp_path),
    ) as client:
        await upload_resume(client)
        await client.post("/jobs", json=job_payload())
        await client.post("/applications", json=external_payload())
        await client.post(
            "/reusable-answers",
            json={"question_text": "How did you hear about us?", "answer_text": "A friend"},
        )
        response = await client.get("/me/export")
        assert response.status_code == 200
        assert "attachment" in response.headers["content-disposition"]
        data = response.json()
        assert data["format_version"] == 1
        assert len(data["jobs"]) == 1
        assert len(data["job_requirements"]) == 1
        assert len(data["applications"]) == 1
        assert len(data["application_answers"]) == 1
        assert len(data["resume_versions"]) == 1
        assert data["reusable_answers"][0]["answer_text"] == "A friend"
        assert "storage_key" not in data["resume_files"][0]

        async with make_integration_client(user_id=uuid4(), brain_id=uuid4()) as other:
            other_data = (await other.get("/me/export")).json()
            assert other_data["jobs"] == []
            assert other_data["applications"] == []


@pytest.mark.asyncio
async def test_account_delete_requires_confirmation_and_removes_everything(
    tmp_path: Path,
) -> None:
    user_id = uuid4()
    async with make_integration_client(
        user_id=user_id,
        brain_id=uuid4(),
        resume_parser=EmptyResumeParser(),
        job_parser=FakeJobParser(),
        resume_storage_dir=str(tmp_path),
    ) as client:
        await upload_resume(client)
        await client.post("/jobs", json=job_payload())
        await client.post("/applications", json=external_payload())

        assert (await client.request("DELETE", "/me", json={})).status_code == 422
        assert (await client.request("DELETE", "/me", json={"confirm": "yes"})).status_code == 422
        response = await client.request("DELETE", "/me", json={"confirm": "DELETE"})
        assert response.status_code == 204
        assert list(tmp_path.iterdir()) == []

    engine = create_async_engine(get_test_db_url())
    async with async_sessionmaker(engine)() as session:
        assert await session.scalar(select(func.count(User.id)).where(User.id == user_id)) == 0
        assert (
            await session.scalar(
                select(func.count(CareerBrain.id)).where(CareerBrain.user_id == user_id)
            )
            == 0
        )
    await engine.dispose()
