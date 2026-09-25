import asyncio
from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from conftest import get_test_db_url, make_integration_client, make_test_settings
from docx import Document
from fastapi.testclient import TestClient
from sqlalchemy import update
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from careeros_api.job_schemas import ParsedJobDescription, ParsedJobRequirement
from careeros_api.main import create_app
from careeros_api.models import (
    Job,
    JobRequirementCategory,
    JobRequirementImportance,
    RequirementConfidence,
)
from careeros_api.resume_schemas import ParsedResumeDraft

pytestmark = pytest.mark.integration


class FakeJobParser:
    model = "fake-job-parser"

    async def parse_job_description(self, job_description: str) -> ParsedJobDescription:
        source = "Python experience required"
        return ParsedJobDescription(
            requirements=[
                ParsedJobRequirement(
                    category=JobRequirementCategory.EXPERIENCE,
                    description=source,
                    normalized_value="Python",
                    importance=JobRequirementImportance.REQUIRED,
                    source_text=source,
                    confidence=RequirementConfidence.HIGH,
                )
            ]
        )


class EmptyResumeParser:
    async def parse_resume_to_career_draft(self, resume_text: str) -> ParsedResumeDraft:
        return ParsedResumeDraft()


def resume_docx() -> bytes:
    document = Document()
    document.add_paragraph("Example resume")
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def external_payload(
    *,
    idempotency_key: UUID | None = None,
    company: str = "External Corp",
    status: str = "PREPARING",
) -> dict[str, object]:
    return {
        "idempotency_key": str(idempotency_key or uuid4()),
        "origin": "EXTERNAL_PAGE",
        "company": company,
        "role": "Platform Engineer",
        "application_url": "https://jobs.example.com/platform/apply",
        "source": "company_site",
        "status": status,
        "answers": [
            {
                "canonical_key": "CONTACT_EMAIL",
                "question_text": "Email",
                "answer_text": "candidate@example.com",
                "source_category": "IDENTITY",
                "policy_category": "STANDARD",
                "sensitivity": "NONE",
                "user_confirmed": True,
            }
        ],
    }


def job_payload() -> dict[str, object]:
    return {
        "company": "Canonical Corp",
        "title": "Backend Engineer",
        "location": "Remote",
        "description": "Join the team. Python experience required for this position.",
        "source_url": "https://jobs.example.com/backend",
        "application_url": "https://jobs.example.com/backend/apply",
    }


def test_application_endpoints_require_authentication() -> None:
    application = create_app(make_test_settings())
    with TestClient(application) as client:
        assert client.get("/applications").status_code == 401
        assert client.post("/applications", json=external_payload()).status_code == 401
        assert (
            client.post(
                "/applications/assistant-context",
                json={"application_url": "https://jobs.example.com/apply"},
            ).status_code
            == 401
        )


@pytest.mark.asyncio
async def test_external_application_persists_answers_and_can_be_listed() -> None:
    async with make_integration_client() as client:
        created = await client.post("/applications", json=external_payload(status="APPLIED"))
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["job_id"] is None
        assert body["company"] == "External Corp"
        assert body["role"] == "Platform Engineer"
        assert body["origin"] == "EXTERNAL_PAGE"
        assert body["status"] == "APPLIED"
        assert body["applied_at"] is not None
        assert body["answers"] == [
            {
                "id": body["answers"][0]["id"],
                "canonical_key": "CONTACT_EMAIL",
                "question_text": "Email",
                "answer_text": "candidate@example.com",
                "source_category": "IDENTITY",
                "policy_category": "STANDARD",
                "sensitivity": "NONE",
                "position": 0,
                "confirmed_at": body["answers"][0]["confirmed_at"],
                "created_at": body["answers"][0]["created_at"],
            }
        ]

        listed = await client.get("/applications", params={"status": "APPLIED"})
        assert listed.status_code == 200
        assert [item["id"] for item in listed.json()] == [body["id"]]
        assert "answers" not in listed.json()[0]
        assert (await client.get("/applications", params={"status": "PREPARING"})).json() == []
        assert (await client.get(f"/applications/{body['id']}")).json() == body


@pytest.mark.asyncio
async def test_create_is_idempotent_and_detects_key_reuse() -> None:
    key = uuid4()
    async with make_integration_client() as client:
        first = await client.post("/applications", json=external_payload(idempotency_key=key))
        retry = await client.post("/applications", json=external_payload(idempotency_key=key))
        conflict = await client.post(
            "/applications",
            json=external_payload(idempotency_key=key, company="Different Corp"),
        )

        assert first.status_code == 201
        assert retry.status_code == 200
        assert retry.json() == first.json()
        assert conflict.status_code == 409
        assert conflict.json()["detail"]["code"] == "IDEMPOTENCY_CONFLICT"
        assert len((await client.get("/applications")).json()) == 1


@pytest.mark.asyncio
async def test_concurrent_create_retries_do_not_duplicate_application() -> None:
    key = uuid4()
    payload = external_payload(idempotency_key=key)
    async with make_integration_client() as client:
        responses = await asyncio.gather(
            *(client.post("/applications", json=payload) for _ in range(5))
        )

        assert sorted(response.status_code for response in responses) == [200, 200, 200, 200, 201]
        assert len({response.json()["id"] for response in responses}) == 1
        assert len((await client.get("/applications")).json()) == 1


@pytest.mark.asyncio
async def test_canonical_job_and_exact_resume_are_owned_and_snapshotted(tmp_path: Path) -> None:
    user_id = uuid4()
    async with make_integration_client(
        user_id=user_id,
        job_parser=FakeJobParser(),
        resume_parser=EmptyResumeParser(),
        resume_storage_dir=str(tmp_path),
    ) as client:
        job = await client.post("/jobs", json=job_payload())
        assert job.status_code == 201, job.text
        upload = await client.post(
            "/resume-imports",
            files={"file": ("base.docx", resume_docx(), "application/octet-stream")},
        )
        assert upload.status_code == 201, upload.text
        resume_version_id = upload.json()["resume_version_id"]

        create_key = uuid4()
        application_payload = {
            "idempotency_key": str(create_key),
            "origin": "CAREEROS_JOB",
            "job_id": job.json()["id"],
            "resume_version_id": resume_version_id,
            "status": "PREPARING",
            "answers": [
                {
                    "canonical_key": "RESUME_FILE",
                    "question_text": "Resume",
                    "answer_text": "base.docx",
                    "source_category": "RESUME_VERSION",
                    "policy_category": "STANDARD",
                    "sensitivity": "NONE",
                    "user_confirmed": True,
                }
            ],
        }
        created = await client.post(
            "/applications",
            json=application_payload,
        )
        assert created.status_code == 201, created.text
        body = created.json()
        assert body["company"] == "Canonical Corp"
        assert body["role"] == "Backend Engineer"
        assert body["application_url"] == "https://jobs.example.com/backend/apply"
        assert body["resume_version_id"] == resume_version_id

        engine = create_async_engine(get_test_db_url(), pool_pre_ping=True)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            await session.execute(
                update(Job)
                .where(Job.id == UUID(job.json()["id"]))
                .values(company="Changed Corp", title="Changed Role")
            )
            await session.commit()
        await engine.dispose()

        historical = (await client.get(f"/applications/{body['id']}")).json()
        assert historical["company"] == "Canonical Corp"
        assert historical["role"] == "Backend Engineer"
        assert historical["resume_version_id"] == resume_version_id
        assert historical["answers"][0]["answer_text"] == "base.docx"

        retry = await client.post("/applications", json=application_payload)
        assert retry.status_code == 200
        assert retry.json() == body


@pytest.mark.asyncio
async def test_assistant_context_is_minimal_exact_and_ambiguity_safe(tmp_path: Path) -> None:
    async with make_integration_client(
        resume_parser=EmptyResumeParser(),
        resume_storage_dir=str(tmp_path),
    ) as client:
        upload = await client.post(
            "/resume-imports",
            files={"file": ("private.docx", resume_docx(), "application/octet-stream")},
        )
        assert upload.status_code == 201
        resume_version_id = upload.json()["resume_version_id"]
        created = await client.post(
            "/applications",
            json={
                **external_payload(),
                "resume_version_id": resume_version_id,
            },
        )
        assert created.status_code == 201

        context = await client.post(
            "/applications/assistant-context",
            json={"application_url": "https://jobs.example.com/platform/apply/?redirect=1#form"},
        )
        assert context.status_code == 200, context.text
        body = context.json()
        assert body["match_kind"] == "EXACT_URL"
        assert body["application"] == {
            "id": created.json()["id"],
            "company": "External Corp",
            "role": "Platform Engineer",
            "application_url": "https://jobs.example.com/platform/apply",
            "resume_version_id": resume_version_id,
            "status": "PREPARING",
            "origin": "EXTERNAL_PAGE",
            "created_at": created.json()["created_at"],
        }
        assert body["resume_versions"] == [
            {
                "id": resume_version_id,
                "label": "private · Version 1",
            }
        ]
        assert "extracted_text" not in context.text
        assert "structured_content" not in context.text

        duplicate = await client.post(
            "/applications",
            json=external_payload(company="Another role at the same URL"),
        )
        assert duplicate.status_code == 201
        ambiguous = await client.post(
            "/applications/assistant-context",
            json={"application_url": "https://jobs.example.com/platform/apply"},
        )
        assert ambiguous.status_code == 200
        assert ambiguous.json()["match_kind"] == "NONE"
        assert ambiguous.json()["application"] is None


@pytest.mark.asyncio
async def test_assistant_context_recent_fallback_is_unique_and_owner_scoped() -> None:
    owner_id, other_id = uuid4(), uuid4()
    async with make_integration_client(user_id=owner_id) as owner:
        created = await owner.post("/applications", json=external_payload())
        assert created.status_code == 201

        recent = await owner.post(
            "/applications/assistant-context",
            json={"application_url": "https://redirected.example.com/application"},
        )
        assert recent.status_code == 200
        assert recent.json()["match_kind"] == "RECENT_PREPARING"
        assert recent.json()["application"]["id"] == created.json()["id"]

        async with make_integration_client(user_id=other_id) as other:
            isolated = await other.post(
                "/applications/assistant-context",
                json={"application_url": "https://jobs.example.com/platform/apply"},
            )
            assert isolated.status_code == 200
            assert isolated.json() == {
                "match_kind": "NONE",
                "application": None,
                "resume_versions": [],
            }


@pytest.mark.asyncio
async def test_status_update_is_idempotent_and_preserves_applied_at() -> None:
    async with make_integration_client() as client:
        created = await client.post("/applications", json=external_payload())
        application_id = created.json()["id"]
        key = uuid4()
        update_payload = {"idempotency_key": str(key), "status": "APPLIED"}

        first = await client.patch(f"/applications/{application_id}/status", json=update_payload)
        retry = await client.patch(f"/applications/{application_id}/status", json=update_payload)
        conflict = await client.patch(
            f"/applications/{application_id}/status",
            json={"idempotency_key": str(key), "status": "INTERVIEW"},
        )
        later = await client.patch(
            f"/applications/{application_id}/status",
            json={"idempotency_key": str(uuid4()), "status": "INTERVIEW"},
        )

        assert first.status_code == 200
        assert first.json()["applied_at"] is not None
        assert retry.status_code == 200
        assert retry.json()["applied_at"] == first.json()["applied_at"]
        assert conflict.status_code == 409
        assert later.status_code == 200
        assert later.json()["status"] == "INTERVIEW"
        assert later.json()["applied_at"] == first.json()["applied_at"]


@pytest.mark.asyncio
async def test_concurrent_status_retries_return_the_committed_state() -> None:
    async with make_integration_client() as client:
        created = await client.post("/applications", json=external_payload())
        application_id = created.json()["id"]
        update_payload = {"idempotency_key": str(uuid4()), "status": "APPLIED"}

        responses = await asyncio.gather(
            *(
                client.patch(
                    f"/applications/{application_id}/status",
                    json=update_payload,
                )
                for _ in range(5)
            )
        )

        assert all(response.status_code == 200 for response in responses)
        assert {response.json()["status"] for response in responses} == {"APPLIED"}
        assert len({response.json()["applied_at"] for response in responses}) == 1


@pytest.mark.asyncio
async def test_status_update_key_cannot_be_reused_for_another_application() -> None:
    key = uuid4()
    async with make_integration_client() as client:
        first_application = await client.post("/applications", json=external_payload())
        second_application = await client.post(
            "/applications",
            json=external_payload(company="Second Corp"),
        )

        first_update = await client.patch(
            f"/applications/{first_application.json()['id']}/status",
            json={"idempotency_key": str(key), "status": "APPLIED"},
        )
        conflicting_update = await client.patch(
            f"/applications/{second_application.json()['id']}/status",
            json={"idempotency_key": str(key), "status": "APPLIED"},
        )

        assert first_update.status_code == 200
        assert conflicting_update.status_code == 409
        assert conflicting_update.json()["detail"]["code"] == "IDEMPOTENCY_CONFLICT"


@pytest.mark.asyncio
async def test_all_v1_application_statuses_are_supported() -> None:
    statuses = (
        "PREPARING",
        "APPLIED",
        "ASSESSMENT",
        "INTERVIEW",
        "FINAL",
        "REJECTED",
        "OFFER",
        "WITHDRAWN",
    )
    async with make_integration_client() as client:
        for application_status in statuses:
            payload = external_payload(company=f"{application_status} Corp")
            payload["status"] = application_status
            created = await client.post("/applications", json=payload)

            assert created.status_code == 201, created.text
            assert created.json()["status"] == application_status
            assert (created.json()["applied_at"] is None) == (application_status == "PREPARING")


@pytest.mark.asyncio
async def test_submission_completes_preparing_application_idempotently(tmp_path: Path) -> None:
    async with make_integration_client(
        resume_parser=EmptyResumeParser(),
        resume_storage_dir=str(tmp_path),
    ) as client:
        upload = await client.post(
            "/resume-imports",
            files={"file": ("submitted.docx", resume_docx(), "application/octet-stream")},
        )
        assert upload.status_code == 201
        resume_version_id = upload.json()["resume_version_id"]
        created = await client.post("/applications", json=external_payload())
        application_id = created.json()["id"]
        key = uuid4()
        submission = {
            "idempotency_key": str(key),
            "resume_version_id": resume_version_id,
            "answers": [
                {
                    "canonical_key": "CONTACT_EMAIL",
                    "question_text": "Email",
                    "answer_text": "submitted@example.com",
                    "source_category": "IDENTITY",
                    "policy_category": "STANDARD",
                    "sensitivity": "NONE",
                    "user_confirmed": True,
                }
            ],
        }

        first = await client.post(
            f"/applications/{application_id}/submission",
            json=submission,
        )
        retry = await client.post(
            f"/applications/{application_id}/submission",
            json=submission,
        )
        conflict = await client.post(
            f"/applications/{application_id}/submission",
            json={**submission, "resume_version_id": None},
        )

        assert first.status_code == 200, first.text
        assert first.json()["status"] == "APPLIED"
        assert first.json()["applied_at"] is not None
        assert first.json()["resume_version_id"] == resume_version_id
        assert [answer["answer_text"] for answer in first.json()["answers"]] == [
            "candidate@example.com",
            "submitted@example.com",
        ]
        assert retry.status_code == 200
        assert retry.json() == first.json()
        assert conflict.status_code == 409


@pytest.mark.asyncio
async def test_submission_preserves_later_status_and_rejects_resume_replacement(
    tmp_path: Path,
) -> None:
    async with make_integration_client(
        resume_parser=EmptyResumeParser(),
        resume_storage_dir=str(tmp_path),
    ) as client:
        first_upload = await client.post(
            "/resume-imports",
            files={"file": ("first.docx", resume_docx(), "application/octet-stream")},
        )
        second_upload = await client.post(
            "/resume-imports",
            files={"file": ("second.docx", resume_docx(), "application/octet-stream")},
        )
        created = await client.post(
            "/applications",
            json={
                **external_payload(status="INTERVIEW"),
                "resume_version_id": first_upload.json()["resume_version_id"],
            },
        )
        application_id = created.json()["id"]

        submitted = await client.post(
            f"/applications/{application_id}/submission",
            json={"idempotency_key": str(uuid4()), "answers": []},
        )
        replacement = await client.post(
            f"/applications/{application_id}/submission",
            json={
                "idempotency_key": str(uuid4()),
                "resume_version_id": second_upload.json()["resume_version_id"],
                "answers": [],
            },
        )

        assert submitted.status_code == 200
        assert submitted.json()["status"] == "INTERVIEW"
        assert submitted.json()["applied_at"] == created.json()["applied_at"]
        assert replacement.status_code == 409


@pytest.mark.asyncio
async def test_sensitive_or_unconfirmed_answer_history_is_rejected() -> None:
    async with make_integration_client() as client:
        payload = external_payload()
        answer = payload["answers"][0]  # type: ignore[index]
        answer["policy_category"] = "SENSITIVE"  # type: ignore[index]
        answer["sensitivity"] = "SENSITIVE"  # type: ignore[index]
        assert (await client.post("/applications", json=payload)).status_code == 422

        payload = external_payload()
        answer = payload["answers"][0]  # type: ignore[index]
        answer["user_confirmed"] = False  # type: ignore[index]
        assert (await client.post("/applications", json=payload)).status_code == 422

        payload = external_payload()
        answer = payload["answers"][0]  # type: ignore[index]
        answer["source_category"] = "RESUME_VERSION"  # type: ignore[index]
        assert (await client.post("/applications", json=payload)).status_code == 422


@pytest.mark.asyncio
async def test_application_ownership_and_nested_reference_isolation(tmp_path: Path) -> None:
    owner_id, other_id = uuid4(), uuid4()
    async with make_integration_client(user_id=owner_id, job_parser=FakeJobParser()) as owner:
        created = await owner.post("/applications", json=external_payload())
        application_id = created.json()["id"]
        async with make_integration_client(
            user_id=other_id,
            job_parser=FakeJobParser(),
            resume_parser=EmptyResumeParser(),
            resume_storage_dir=str(tmp_path),
        ) as other:
            upload = await other.post(
                "/resume-imports",
                files={"file": ("foreign.docx", resume_docx(), "application/octet-stream")},
            )
            assert upload.status_code == 201
            foreign_resume_id = upload.json()["resume_version_id"]
            foreign_job = await other.post("/jobs", json=job_payload())
            assert foreign_job.status_code == 201

            assert (await other.get(f"/applications/{application_id}")).status_code == 404
            assert (
                await other.patch(
                    f"/applications/{application_id}/status",
                    json={"idempotency_key": str(uuid4()), "status": "APPLIED"},
                )
            ).status_code == 404
            assert (
                await other.post(
                    f"/applications/{application_id}/submission",
                    json={"idempotency_key": str(uuid4()), "answers": []},
                )
            ).status_code == 404
            payload = external_payload()
            payload["resume_version_id"] = foreign_resume_id
            assert (await owner.post("/applications", json=payload)).status_code == 404

            job_application = {
                "idempotency_key": str(uuid4()),
                "origin": "CAREEROS_JOB",
                "job_id": foreign_job.json()["id"],
            }
            assert (await owner.post("/applications", json=job_application)).status_code == 404
