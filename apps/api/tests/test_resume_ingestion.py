from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from conftest import get_test_db_url, make_integration_client
from docx import Document
from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from careeros_api.models import (
    CareerEvidence,
    CareerEvidenceRevision,
    ConfirmationStatus,
    Education,
    EvidenceOrigin,
    Experience,
    Project,
    Resume,
    ResumeAsset,
    ResumeDraftItem,
    ResumeVersion,
    Skill,
)
from careeros_api.resume_schemas import (
    ParsedContactInfo,
    ParsedContactValue,
    ParsedDetail,
    ParsedEducation,
    ParsedExperience,
    ParsedProject,
    ParsedResumeDraft,
    ParsedSkill,
)

pytestmark = pytest.mark.integration


def make_resume_docx() -> bytes:
    document = Document()
    for line in (
        "State University, BS Computer Science, 2018 - 2022",
        "Acme Corp - Software Engineer - 2022 to present",
        "Improved API latency by 40%",
        "Career Tracker",
        "Built a job application tracker",
        "Python, SQL",
        "Ada Lovelace",
        "+44 1234567",
    ):
        document.add_paragraph(line)
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


def parsed_resume() -> ParsedResumeDraft:
    return ParsedResumeDraft(
        educations=[
            ParsedEducation(
                institution="State University",
                degree="BS",
                field_of_study="Computer Science",
                start_date="2018",
                end_date="2022",
                source_text="State University, BS Computer Science, 2018 - 2022",
            )
        ],
        experiences=[
            ParsedExperience(
                company="Acme Corp",
                title="Software Engineer",
                start_date="2022",
                is_current=True,
                source_text="Acme Corp - Software Engineer - 2022 to present",
                details=[
                    ParsedDetail(
                        content="Improved API latency by 40%",
                        source_text="Improved API latency by 40%",
                    )
                ],
            )
        ],
        projects=[
            ParsedProject(
                name="Career Tracker",
                description="Built a job application tracker",
                source_text="Career Tracker Built a job application tracker",
                details=[
                    ParsedDetail(
                        content="Built a job application tracker",
                        source_text="Built a job application tracker",
                    )
                ],
            )
        ],
        skills=[
            ParsedSkill(name="Python", source_text="Python"),
            ParsedSkill(name="SQL", source_text="SQL"),
        ],
        contact_info=ParsedContactInfo(
            first_name=ParsedContactValue(value="Ada", source_text="Ada Lovelace"),
            last_name=ParsedContactValue(value="Lovelace", source_text="Ada Lovelace"),
            phone=ParsedContactValue(value="+44 1234567", source_text="+44 1234567"),
        ),
    )


class FakeResumeParser:
    def __init__(self, result: object) -> None:
        self.result = result
        self.seen_text: str | None = None

    async def parse_resume_to_career_draft(self, resume_text: str) -> ParsedResumeDraft:
        self.seen_text = resume_text
        return self.result  # type: ignore[return-value]


async def counts() -> dict[str, int]:
    engine = create_async_engine(get_test_db_url())
    factory = async_sessionmaker(engine, expire_on_commit=False)
    async with factory() as session:
        result = {
            "educations": await session.scalar(select(func.count(Education.id))) or 0,
            "experiences": await session.scalar(select(func.count(Experience.id))) or 0,
            "projects": await session.scalar(select(func.count(Project.id))) or 0,
            "skills": await session.scalar(select(func.count(Skill.id))) or 0,
        }
    await engine.dispose()
    return result


@pytest.mark.asyncio
async def test_upload_review_correct_remove_confirm_and_library(tmp_path: Path) -> None:
    parser = FakeResumeParser(parsed_resume())
    before = await counts()
    async with make_integration_client(
        resume_parser=parser, resume_storage_dir=str(tmp_path)
    ) as client:
        upload = await client.post(
            "/resume-imports",
            files={"file": ("../my-resume.docx", make_resume_docx(), "application/octet-stream")},
        )
        assert upload.status_code == 201, upload.text
        imported = upload.json()
        assert imported["status"] == "READY_FOR_REVIEW"
        assert imported["contact_info_candidate"] == {
            "first_name": "Ada",
            "last_name": "Lovelace",
            "phone": "+44 1234567",
        }
        assert (await client.get("/contact-info")).json()["id"] is None
        assert parser.seen_text is not None
        assert "Improved API latency by 40%" in parser.seen_text
        assert len(list(tmp_path.iterdir())) == 1
        assert list(tmp_path.iterdir())[0].name.endswith(".docx")
        assert "my-resume" not in list(tmp_path.iterdir())[0].name

        items = imported["items"]
        assert all(item["status"] == "ACTIVE" for item in items)
        experience = next(item for item in items if item["item_type"] == "EXPERIENCE")
        project = next(item for item in items if item["item_type"] == "PROJECT")

        engine = create_async_engine(get_test_db_url())
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            import_id = UUID(imported["id"])
            draft_ids = select(ResumeDraftItem.evidence_id).where(
                ResumeDraftItem.resume_import_id == import_id
            )
            initial_revisions = (
                (
                    await session.execute(
                        select(CareerEvidenceRevision)
                        .join(
                            CareerEvidence,
                            CareerEvidence.current_revision_id == CareerEvidenceRevision.id,
                        )
                        .where(CareerEvidence.id.in_(draft_ids))
                    )
                )
                .scalars()
                .all()
            )
            assert len(initial_revisions) == len(items)
            assert all(
                revision.origin == EvidenceOrigin.RESUME_IMPORT.value
                and revision.confirmation_status == ConfirmationStatus.UNCONFIRMED.value
                for revision in initial_revisions
            )
        await engine.dispose()

        corrected = await client.patch(
            f"/resume-imports/{imported['id']}/items/{experience['id']}",
            json={"data": {"title": "Senior Software Engineer"}},
        )
        assert corrected.status_code == 200, corrected.text
        assert corrected.json()["data"]["title"] == "Senior Software Engineer"
        assert corrected.json()["data"]["source_text"] == experience["data"]["source_text"]

        removed = await client.delete(f"/resume-imports/{imported['id']}/items/{project['id']}")
        assert removed.status_code == 200
        assert removed.json()["status"] == "REMOVED"

        confirmed = await client.post(
            f"/resume-imports/{imported['id']}/confirm",
            json={
                "contact_info": {
                    "first_name": "Ada",
                    "last_name": "Lovelace",
                    "phone": "+44 1234567",
                }
            },
        )
        assert confirmed.status_code == 200, confirmed.text
        assert confirmed.json()["status"] == "CONFIRMED"
        contact = (await client.get("/contact-info")).json()
        assert contact["first_name"] == "Ada"
        assert contact["last_name"] == "Lovelace"
        assert contact["phone"] == "+44 1234567"

        brain = (await client.get("/career-brain")).json()
        assert brain["educations"][0]["institution"] == "State University"
        assert brain["experiences"][0]["title"] == "Senior Software Engineer"
        assert brain["experiences"][0]["details"][0]["content"].endswith("40%")
        assert brain["projects"] == []
        assert {skill["name"] for skill in brain["skills"]} == {"Python", "SQL"}

        library = await client.get("/resumes")
        assert library.status_code == 200
        assert len(library.json()) == 1
        resume = library.json()[0]
        assert resume["is_primary"] is True
        assert resume["versions"][0]["version_number"] == 1
        version_id = resume["versions"][0]["id"]
        detail = await client.get(f"/resumes/{resume['id']}")
        assert detail.json()["versions"][0]["id"] == version_id
        version_detail = await client.get(f"/resumes/{resume['id']}/versions/{version_id}")
        assert version_detail.status_code == 200
        assert version_detail.json()["id"] == version_id
        assert (await client.patch(f"/resumes/{resume['id']}", json={})).status_code == 405

        # Confirmation is idempotent and never duplicates Career Brain facts.
        again = await client.post(f"/resume-imports/{imported['id']}/confirm")
        assert again.status_code == 200
        assert await counts() == {
            "educations": before["educations"] + 1,
            "experiences": before["experiences"] + 1,
            "projects": before["projects"],
            "skills": before["skills"] + 2,
        }

        engine = create_async_engine(get_test_db_url())
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            draft_ids = select(ResumeDraftItem.evidence_id).where(
                ResumeDraftItem.resume_import_id == import_id,
                ResumeDraftItem.status == "CONFIRMED",
            )
            revisions = (
                (
                    await session.execute(
                        select(CareerEvidenceRevision)
                        .join(CareerEvidence)
                        .where(CareerEvidence.id.in_(draft_ids))
                    )
                )
                .scalars()
                .all()
            )
            assert revisions
            assert all(
                revision.origin == EvidenceOrigin.RESUME_IMPORT.value for revision in revisions
            )
            current_statuses = (
                (
                    await session.execute(
                        select(CareerEvidenceRevision.confirmation_status)
                        .join(
                            CareerEvidence,
                            CareerEvidence.current_revision_id == CareerEvidenceRevision.id,
                        )
                        .where(CareerEvidence.id.in_(draft_ids))
                    )
                )
                .scalars()
                .all()
            )
            assert set(current_statuses) == {ConfirmationStatus.CONFIRMED.value}
            experience_evidence_id = await session.scalar(
                select(ResumeDraftItem.evidence_id).where(
                    ResumeDraftItem.id == UUID(experience["id"])
                )
            )
            assert (
                await session.scalar(
                    select(func.count(CareerEvidenceRevision.id)).where(
                        CareerEvidenceRevision.evidence_id == experience_evidence_id
                    )
                )
                == 3
            )
        await engine.dispose()


@pytest.mark.asyncio
async def test_separate_imports_do_not_duplicate_identical_facts(tmp_path: Path) -> None:
    parser = FakeResumeParser(parsed_resume())
    before = await counts()
    async with make_integration_client(
        resume_parser=parser, resume_storage_dir=str(tmp_path)
    ) as client:
        for filename in ("resume-one.docx", "resume-two.docx"):
            upload = await client.post(
                "/resume-imports",
                files={"file": (filename, make_resume_docx(), "application/octet-stream")},
            )
            assert upload.status_code == 201
            confirmed = await client.post(f"/resume-imports/{upload.json()['id']}/confirm")
            assert confirmed.status_code == 200

        assert await counts() == {
            "educations": before["educations"] + 1,
            "experiences": before["experiences"] + 1,
            "projects": before["projects"] + 1,
            "skills": before["skills"] + 2,
        }


@pytest.mark.asyncio
async def test_upload_validation_and_malformed_parser_output(tmp_path: Path) -> None:
    parser = FakeResumeParser({"experiences": [{"company": "Missing required fields"}]})
    async with make_integration_client(
        resume_parser=parser, resume_storage_dir=str(tmp_path)
    ) as client:
        invalid = await client.post(
            "/resume-imports", files={"file": ("resume.txt", b"plain text", "application/pdf")}
        )
        assert invalid.status_code == 422
        assert invalid.json()["detail"]["code"] == "UNSUPPORTED_FILE_TYPE"

        malformed_ai = await client.post(
            "/resume-imports",
            files={"file": ("resume.docx", make_resume_docx(), "application/octet-stream")},
        )
        assert malformed_ai.status_code == 422
        assert malformed_ai.json()["detail"]["code"] == "PARSING_FAILED"
        assert list(tmp_path.iterdir()) == []


@pytest.mark.asyncio
async def test_upload_limit_returns_stable_error_before_file_processing(tmp_path: Path) -> None:
    parser = FakeResumeParser(parsed_resume())
    async with make_integration_client(
        resume_parser=parser,
        resume_storage_dir=str(tmp_path),
        max_resume_size_bytes=10,
    ) as client:
        response = await client.post(
            "/resume-imports",
            files={"file": ("resume.pdf", b"%PDF-123456", "application/pdf")},
        )

    assert response.status_code == 413
    assert response.json()["detail"]["code"] == "FILE_TOO_LARGE"
    assert response.json()["detail"]["max_size_bytes"] == 10
    assert parser.seen_text is None


@pytest.mark.asyncio
async def test_resume_ownership_isolation(tmp_path: Path) -> None:
    parser = FakeResumeParser(parsed_resume())
    owner_id, owner_brain = uuid4(), uuid4()
    async with make_integration_client(
        owner_id, owner_brain, parser, str(tmp_path / "owner")
    ) as owner:
        upload = await owner.post(
            "/resume-imports",
            files={"file": ("resume.docx", make_resume_docx(), "application/octet-stream")},
        )
        assert upload.status_code == 201
        imported = upload.json()
        resume_id = imported["resume_id"]
        import_id = imported["id"]
        item_id = imported["items"][0]["id"]

        async with make_integration_client(
            resume_parser=parser, resume_storage_dir=str(tmp_path / "other")
        ) as other:
            assert (await other.get(f"/resumes/{resume_id}")).status_code == 404
            assert (
                await other.get(f"/resumes/{resume_id}/versions/{imported['resume_version_id']}")
            ).status_code == 404
            assert (await other.get(f"/resume-imports/{import_id}")).status_code == 404
            assert (
                await other.patch(f"/resume-imports/{import_id}/items/{item_id}", json={"data": {}})
            ).status_code == 404
            assert (await other.get("/resumes")).json() == []


@pytest.mark.asyncio
async def test_resume_rows_are_owned_and_version_identity_is_stable(tmp_path: Path) -> None:
    parser = FakeResumeParser(parsed_resume())
    async with make_integration_client(
        resume_parser=parser, resume_storage_dir=str(tmp_path)
    ) as client:
        upload = await client.post(
            "/resume-imports",
            files={"file": ("resume.docx", make_resume_docx(), "application/octet-stream")},
        )
        payload = upload.json()
        version_id = UUID(payload["resume_version_id"])
        resume_id = UUID(payload["resume_id"])

        engine = create_async_engine(get_test_db_url())
        factory = async_sessionmaker(engine, expire_on_commit=False)
        async with factory() as session:
            version = await session.get(ResumeVersion, version_id)
            resume = await session.get(Resume, resume_id)
            asset = await session.get(ResumeAsset, version.asset_id if version else UUID(int=0))
            assert version is not None and resume is not None and asset is not None
            assert version.resume_id == resume.id
            assert asset.user_id == resume.user_id
            assert version.version_number == 1
        await engine.dispose()


@pytest.mark.asyncio
async def test_resume_version_file_download_is_exact_and_owner_scoped(tmp_path: Path) -> None:
    parser = FakeResumeParser(parsed_resume())
    original = make_resume_docx()
    async with make_integration_client(uuid4(), uuid4(), parser, str(tmp_path / "owner")) as owner:
        upload = await owner.post(
            "/resume-imports",
            files={"file": ("Ada Résumé.docx", original, "application/octet-stream")},
        )
        version_id = upload.json()["resume_version_id"]

        response = await owner.get(f"/resume-versions/{version_id}/file")
        assert response.status_code == 200
        assert response.content == original
        assert response.headers["cache-control"] == "no-store"
        assert response.headers["x-resume-filename"] == "Ada%20R%C3%A9sum%C3%A9.docx"

        async with make_integration_client(
            resume_parser=parser, resume_storage_dir=str(tmp_path / "owner")
        ) as other:
            assert (await other.get(f"/resume-versions/{version_id}/file")).status_code == 404
