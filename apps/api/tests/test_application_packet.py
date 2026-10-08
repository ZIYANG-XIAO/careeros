"""Integration tests for the read-only Application Packet."""

from pathlib import Path
from uuid import uuid4

import pytest
from conftest import make_integration_client, make_test_settings
from fastapi.testclient import TestClient
from test_job_intelligence import (
    FakeJobParser,
    FakeResumeParser,
    create_job,
    resume_docx,
)

from careeros_api.main import create_app

pytestmark = pytest.mark.integration


@pytest.mark.asyncio
async def test_packet_assembles_the_applications_materials(tmp_path: Path) -> None:
    async with make_integration_client(
        resume_parser=FakeResumeParser(),
        job_parser=FakeJobParser(),
        resume_storage_dir=str(tmp_path),
    ) as client:
        upload = await client.post(
            "/resume-imports",
            files={"file": ("base.docx", resume_docx(), "application/octet-stream")},
        )
        version_id = upload.json()["resume_version_id"]
        job_id = await create_job(client)
        created = await client.post(
            "/applications",
            json={
                "idempotency_key": str(uuid4()),
                "origin": "CAREEROS_JOB",
                "job_id": job_id,
                "resume_version_id": version_id,
                "status": "APPLIED",
                "answers": [],
            },
        )
        application_id = created.json()["id"]
        await client.post(
            f"/applications/{application_id}/contacts",
            json={"name": "Grace", "relationship_type": "RECRUITER"},
        )
        await client.post(
            f"/applications/{application_id}/activities",
            json={
                "idempotency_key": str(uuid4()),
                "activity_type": "NOTE",
                "title": "Sent thank-you note",
            },
        )

        packet = await client.get(f"/applications/{application_id}/packet")
        assert packet.status_code == 200, packet.text
        body = packet.json()
        assert body["application"]["id"] == application_id
        assert body["resume_version"]["id"] == version_id
        assert body["resume_version"]["original_filename"] == "base.docx"
        assert body["job_snapshot"]["version_number"] == 1
        assert body["job_snapshot"]["basis"] == "AT_SUBMISSION"
        assert "Kafka experience required." in body["job_snapshot"]["description"]
        assert [entry["to_status"] for entry in body["status_history"]] == ["APPLIED"]
        assert [contact["name"] for contact in body["contacts"]] == ["Grace"]
        assert [activity["title"] for activity in body["activities"]] == ["Sent thank-you note"]


@pytest.mark.asyncio
async def test_manual_application_packet_has_no_job_or_resume() -> None:
    async with make_integration_client() as client:
        created = await client.post(
            "/applications",
            json={
                "idempotency_key": str(uuid4()),
                "origin": "MANUAL",
                "company": "Acme",
                "role": "Engineer",
                "source": "manual",
                "status": "PREPARING",
                "answers": [],
            },
        )
        body = (await client.get(f"/applications/{created.json()['id']}/packet")).json()
        assert body["resume_version"] is None
        assert body["job_snapshot"] is None


@pytest.mark.asyncio
async def test_packet_is_owner_scoped() -> None:
    async with make_integration_client() as owner:
        created = await owner.post(
            "/applications",
            json={
                "idempotency_key": str(uuid4()),
                "origin": "MANUAL",
                "company": "Acme",
                "role": "Engineer",
                "source": "manual",
                "status": "PREPARING",
                "answers": [],
            },
        )
        async with make_integration_client() as other:
            response = await other.get(f"/applications/{created.json()['id']}/packet")
            assert response.status_code == 404


def test_packet_requires_authentication() -> None:
    with TestClient(create_app(make_test_settings())) as client:
        assert client.get(f"/applications/{uuid4()}/packet").status_code == 401
