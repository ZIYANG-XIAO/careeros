"""Integration tests for count-only requirement-gap insights."""

from pathlib import Path

import pytest
from conftest import make_integration_client, make_test_settings
from fastapi.testclient import TestClient
from test_job_intelligence import (
    FakeJobMatcher,
    FakeJobParser,
    FakeResumeParser,
    create_job,
    create_resume_and_evidence,
    resume_docx,
)

from careeros_api.main import create_app

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_requirement_gaps_count_latest_analysis_of_tracked_jobs(tmp_path: Path) -> None:
    async with make_integration_client(
        resume_parser=FakeResumeParser(),
        job_parser=FakeJobParser(),
        job_matcher=FakeJobMatcher(),
        resume_storage_dir=str(tmp_path),
    ) as client:
        empty = (await client.get("/insights/requirement-gaps")).json()
        assert empty == {"tracked_job_count": 0, "analyzed_job_count": 0, "requirements": []}

        resume_version_id, _ = await create_resume_and_evidence(client)
        saved_a = await create_job(client)
        saved_b = await create_job(client)
        untracked = await create_job(client)
        for job_id in (saved_a, saved_b):
            assert (await client.post(f"/jobs/{job_id}/save")).status_code == 200
        await client.delete(f"/jobs/{untracked}/save")
        for job_id in (saved_a, saved_a, saved_b, untracked):
            response = await client.post(
                f"/jobs/{job_id}/analyses", json={"resume_version_id": resume_version_id}
            )
            assert response.status_code == 201, response.text

        body = (await client.get("/insights/requirement-gaps")).json()
        assert body["tracked_job_count"] == 2
        assert body["analyzed_job_count"] == 2
        by_label = {item["label"]: item for item in body["requirements"]}
        # Re-analysis of saved_a is not double-counted; the unsaved job is excluded.
        assert by_label["GCP"]["job_count"] == 2
        assert by_label["GCP"]["genuine_gap_count"] == 2
        assert by_label["Kubernetes"]["weak_evidence_count"] == 2
        assert by_label["Kafka"]["hidden_evidence_count"] == 2
        assert {job["job_id"] for job in by_label["GCP"]["jobs"]} == {saved_a, saved_b}
        assert by_label["GCP"]["jobs"][0]["classification"] == "GENUINE_GAP"


@pytest.mark.asyncio
async def test_requirement_gaps_are_owner_scoped(tmp_path: Path) -> None:
    async with make_integration_client(
        resume_parser=FakeResumeParser(),
        job_parser=FakeJobParser(),
        job_matcher=FakeJobMatcher(),
        resume_storage_dir=str(tmp_path / "owner"),
    ) as owner:
        resume_version_id, _ = await create_resume_and_evidence(owner)
        job_id = await create_job(owner)
        await owner.post(f"/jobs/{job_id}/save")
        await owner.post(f"/jobs/{job_id}/analyses", json={"resume_version_id": resume_version_id})
        assert (await owner.get("/insights/requirement-gaps")).json()["requirements"]

        async with make_integration_client() as other:
            body = (await other.get("/insights/requirement-gaps")).json()
            assert body == {"tracked_job_count": 0, "analyzed_job_count": 0, "requirements": []}


@pytest.mark.asyncio
async def test_pending_resume_imports_list_only_unreviewed_owned_imports(tmp_path: Path) -> None:
    async with make_integration_client(
        resume_parser=FakeResumeParser(),
        resume_storage_dir=str(tmp_path / "owner"),
    ) as owner:
        upload = await owner.post(
            "/resume-imports",
            files={"file": ("base.docx", resume_docx(), "application/octet-stream")},
        )
        assert upload.status_code == 201, upload.text
        pending = (await owner.get("/insights/pending-resume-imports")).json()
        assert [(item["id"], item["filename"], item["pending_item_count"]) for item in pending] == [
            (upload.json()["id"], "base.docx", 1)
        ]

        async with make_integration_client() as other:
            assert (await other.get("/insights/pending-resume-imports")).json() == []

        await owner.post(f"/resume-imports/{upload.json()['id']}/confirm")
        assert (await owner.get("/insights/pending-resume-imports")).json() == []


@pytest.mark.parametrize("path", ["/insights/requirement-gaps", "/insights/pending-resume-imports"])
def test_insights_require_authentication(path: str) -> None:
    application = create_app(make_test_settings())
    with TestClient(application) as client:
        assert client.get(path).status_code == 401
