"""Integration tests for job dismissals, hidden companies, and applied markers."""

from uuid import uuid4

import pytest
from conftest import make_integration_client, make_test_settings
from fastapi.testclient import TestClient
from test_job_intelligence import JOB_DESCRIPTION, FakeJobParser

from careeros_api.main import create_app

pytestmark = pytest.mark.integration


async def create_job(client: object, company: str, title: str) -> str:
    response = await client.post(  # type: ignore[attr-defined]
        "/jobs",
        json={"company": company, "title": title, "description": JOB_DESCRIPTION},
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


async def browse_titles(client: object, **params: str) -> set[str]:
    response = await client.get("/jobs", params={"source": "all", **params})  # type: ignore[attr-defined]
    assert response.status_code == 200, response.text
    return {job["title"] for job in response.json()}


@pytest.mark.asyncio
async def test_dismissal_hides_job_from_browse_until_undone() -> None:
    async with make_integration_client(job_parser=FakeJobParser()) as client:
        job_id = await create_job(client, "Acme", "Dismiss Me")
        await create_job(client, "Acme", "Keep Me")
        await client.delete(f"/jobs/{job_id}/save")

        assert (await client.post(f"/jobs/{job_id}/dismiss")).status_code == 204
        # Idempotent.
        assert (await client.post(f"/jobs/{job_id}/dismiss")).status_code == 204
        titles = await browse_titles(client)
        assert "Dismiss Me" not in titles and "Keep Me" in titles
        assert "Dismiss Me" in await browse_titles(client, include_hidden="true")

        assert (await client.delete(f"/jobs/{job_id}/dismiss")).status_code == 204
        assert "Dismiss Me" in await browse_titles(client)


@pytest.mark.asyncio
async def test_saved_jobs_are_never_hidden() -> None:
    async with make_integration_client(job_parser=FakeJobParser()) as client:
        job_id = await create_job(client, "Acme", "Saved Role")
        await client.post(f"/jobs/{job_id}/save")
        await client.post(f"/jobs/{job_id}/dismiss")
        saved = (await client.get("/jobs", params={"saved_only": "true"})).json()
        assert [job["title"] for job in saved] == ["Saved Role"]


@pytest.mark.asyncio
async def test_hidden_company_matches_case_and_whitespace_and_can_be_removed() -> None:
    async with make_integration_client(job_parser=FakeJobParser()) as client:
        await create_job(client, "  Globex Corp ", "Globex Role")
        await create_job(client, "Initech", "Initech Role")

        created = await client.post("/hidden-companies", json={"company": "globex corp"})
        assert created.status_code == 201, created.text
        again = await client.post("/hidden-companies", json={"company": "GLOBEX CORP"})
        assert again.json()["id"] == created.json()["id"]

        titles = await browse_titles(client)
        assert "Globex Role" not in titles and "Initech Role" in titles
        listed = (await client.get("/hidden-companies")).json()
        assert [item["company_name"] for item in listed] == ["globex corp"]

        hidden_id = created.json()["id"]
        assert (await client.delete(f"/hidden-companies/{hidden_id}")).status_code == 204
        assert "Globex Role" in await browse_titles(client)
        assert (await client.delete(f"/hidden-companies/{hidden_id}")).status_code == 404


@pytest.mark.asyncio
async def test_browse_marks_jobs_with_the_users_application_status() -> None:
    async with make_integration_client(job_parser=FakeJobParser()) as client:
        job_id = await create_job(client, "Acme", "Applied Role")
        await client.post(
            "/applications",
            json={
                "idempotency_key": str(uuid4()),
                "origin": "CAREEROS_JOB",
                "job_id": job_id,
                "status": "APPLIED",
                "answers": [],
            },
        )
        jobs = (await client.get("/jobs", params={"compact": "true", "collapse": "true"})).json()
        by_title = {job["title"]: job for job in jobs}
        assert by_title["Applied Role"]["application_status"] == "APPLIED"


@pytest.mark.asyncio
async def test_feedback_is_owner_scoped() -> None:
    async with make_integration_client(job_parser=FakeJobParser()) as owner:
        hidden = (await owner.post("/hidden-companies", json={"company": "Acme"})).json()
        async with make_integration_client() as other:
            assert (await other.get("/hidden-companies")).json() == []
            assert (await other.delete(f"/hidden-companies/{hidden['id']}")).status_code == 404
            private_job = await create_job(owner, "Acme", "Private")
            assert (await other.post(f"/jobs/{private_job}/dismiss")).status_code == 404


@pytest.mark.parametrize(
    ("method", "path"),
    [
        ("get", "/hidden-companies"),
        ("post", f"/jobs/{uuid4()}/dismiss"),
    ],
)
def test_feedback_requires_authentication(method: str, path: str) -> None:
    with TestClient(create_app(make_test_settings())) as client:
        assert getattr(client, method)(path).status_code == 401


@pytest.mark.asyncio
async def test_lookup_finds_the_job_for_its_posting_or_apply_page() -> None:
    async with make_integration_client(job_parser=FakeJobParser()) as client:
        # Saved from the posting page by the extension's Job Clipper.
        created = await client.post(
            "/jobs/clip",
            json={
                "company": "Acme",
                "title": "Lookup Role",
                "location": None,
                "description": JOB_DESCRIPTION,
                "source_url": "https://jobs.example.com/acme/123?utm_source=x",
                "market": "UNKNOWN",
                "country_code": "UNKNOWN",
                "workplace_type": "UNKNOWN",
                "employment_type": "UNKNOWN",
            },
        )
        assert created.status_code in (200, 201), created.text
        job_id = created.json()["job"]["id"]
        for url in (
            "https://jobs.example.com/acme/123",
            "https://JOBS.example.com/acme/123/apply?gh_src=feed",
        ):
            found = await client.get("/jobs/lookup", params={"url": url})
            assert found.status_code == 200, (url, found.text)
            assert found.json()["id"] == job_id
        missing = await client.get(
            "/jobs/lookup", params={"url": "https://jobs.example.com/acme/999"}
        )
        assert missing.status_code == 404

        async with make_integration_client() as other:
            hidden = await other.get(
                "/jobs/lookup", params={"url": "https://jobs.example.com/acme/123"}
            )
            assert hidden.status_code == 404
