from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from conftest import make_integration_client
from docx import Document

from careeros_api.answer_classifier import AnswerClassificationError
from careeros_api.answer_engine_schemas import (
    AnswerConfidence,
    CanonicalFieldKey,
    SemanticClassificationBatch,
    SemanticFieldClassification,
    SemanticFieldInput,
)
from careeros_api.resume_schemas import ParsedResumeDraft

pytestmark = pytest.mark.integration


class EmptyResumeParser:
    async def parse_resume_to_career_draft(self, resume_text: str) -> ParsedResumeDraft:
        return ParsedResumeDraft()


class FakeAnswerClassifier:
    def __init__(self) -> None:
        self.field_ids: list[str] = []

    async def classify_fields(
        self, fields: list[SemanticFieldInput]
    ) -> SemanticClassificationBatch:
        self.field_ids = [field.field_id for field in fields]
        return SemanticClassificationBatch(
            classifications=[
                SemanticFieldClassification(
                    field_id=field.field_id,
                    canonical_key=(
                        CanonicalFieldKey.CONTACT_EMAIL
                        if field.question == "Electronic mail"
                        else None
                    ),
                    confidence=(
                        AnswerConfidence.MEDIUM
                        if field.question == "Electronic mail"
                        else AnswerConfidence.LOW
                    ),
                )
                for field in fields
            ]
        )


class FailingAnswerClassifier:
    async def classify_fields(
        self, fields: list[SemanticFieldInput]
    ) -> SemanticClassificationBatch:
        raise AnswerClassificationError("simulated provider failure")


def field(
    field_id: str,
    *,
    canonical_key: str | None,
    question: str,
    control_type: str = "TEXT",
    required: bool = True,
    mapping_confidence: str = "HIGH",
) -> dict[str, object]:
    return {
        "field_id": field_id,
        "canonical_key": canonical_key,
        "question": question,
        "control_type": control_type,
        "required": required,
        "mapping_confidence": mapping_confidence,
        "options": [],
    }


def resume_docx() -> bytes:
    document = Document()
    document.add_paragraph("Example resume")
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


@pytest.mark.asyncio
async def test_known_unknown_sensitive_and_reuse_policy() -> None:
    user_id = UUID("10000000-0000-4000-8000-000000000001")
    async with make_integration_client(user_id=user_id) as client:
        me = (await client.get("/me")).json()
        education = await client.post(
            "/career-brain/educations",
            json={
                "institution": "Example University",
                "degree": "BSc",
                "field_of_study": "Computer Science",
            },
        )
        assert education.status_code == 201
        experience = await client.post(
            "/career-brain/experiences",
            json={
                "company": "Example Corp",
                "title": "Platform Engineer",
                "is_current": True,
            },
        )
        assert experience.status_code == 201

        response = await client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    field(
                        "email",
                        canonical_key="CONTACT_EMAIL",
                        question="Email",
                        control_type="EMAIL",
                    ),
                    field(
                        "school",
                        canonical_key="EDUCATION_SCHOOL",
                        question="School",
                        mapping_confidence="MEDIUM",
                    ),
                    field(
                        "company",
                        canonical_key="EXPERIENCE_COMPANY",
                        question="Current company",
                    ),
                    field("name", canonical_key="PERSON_FIRST_NAME", question="First name"),
                    field(
                        "phone",
                        canonical_key="CONTACT_PHONE",
                        question="Phone",
                        required=False,
                    ),
                    field(
                        "sponsorship",
                        canonical_key=None,
                        question="Will you require visa sponsorship?",
                    ),
                    field(
                        "custom",
                        canonical_key=None,
                        question="Why are you interested in this role?",
                    ),
                    field(
                        "password",
                        canonical_key=None,
                        question="Account password",
                        control_type="UNSUPPORTED",
                    ),
                ]
            },
        )

        assert response.status_code == 200, response.text
        body = response.json()
        decisions = {item["field_id"]: item for item in body["decisions"]}
        assert decisions["email"] == {
            "field_id": "email",
            "canonical_key": "CONTACT_EMAIL",
            "question_category": "STANDARD",
            "proposed_answer": me["email"],
            "source_category": "IDENTITY",
            "source_reference_id": str(user_id),
            "action": "FILL",
            "policy_category": "STANDARD",
            "confidence": "HIGH",
            "sensitivity": "NONE",
            "review_state": "NOT_REQUIRED",
            "reuse_policy": "NOT_APPLICABLE",
            "save_intent_required": False,
        }
        assert decisions["school"]["proposed_answer"] == "Example University"
        assert decisions["school"]["action"] == "SUGGEST"
        assert decisions["school"]["review_state"] == "REVIEW_REQUIRED"
        assert decisions["company"]["proposed_answer"] == "Example Corp"
        assert decisions["name"]["action"] == "ASK"
        assert decisions["phone"]["action"] == "UNKNOWN"
        assert decisions["sponsorship"]["question_category"] == "SPONSORSHIP"
        assert decisions["sponsorship"]["policy_category"] == "CONSEQUENTIAL"
        assert decisions["sponsorship"]["reuse_policy"] == "PROHIBITED"
        assert decisions["custom"]["action"] == "ASK"
        assert decisions["custom"]["reuse_policy"] == "ELIGIBLE_WITH_EXPLICIT_CONSENT"
        assert decisions["custom"]["save_intent_required"] is True
        assert decisions["password"]["policy_category"] == "UNSUPPORTED"
        assert body["semantic_classifier_used"] is False


@pytest.mark.asyncio
async def test_ambiguous_career_brain_records_are_not_guessed() -> None:
    async with make_integration_client() as client:
        for institution in ("First University", "Second University"):
            assert (
                await client.post("/career-brain/educations", json={"institution": institution})
            ).status_code == 201
        for company in ("First Corp", "Second Corp"):
            assert (
                await client.post(
                    "/career-brain/experiences",
                    json={"company": company, "title": "Engineer", "is_current": True},
                )
            ).status_code == 201

        response = await client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    field("school", canonical_key="EDUCATION_SCHOOL", question="School"),
                    field(
                        "company",
                        canonical_key="EXPERIENCE_COMPANY",
                        question="Current company",
                    ),
                ]
            },
        )

        assert response.status_code == 200
        assert [item["action"] for item in response.json()["decisions"]] == ["ASK", "ASK"]
        assert all(item["proposed_answer"] is None for item in response.json()["decisions"])


@pytest.mark.asyncio
async def test_selected_owned_resume_version_resolves_without_exposing_storage_key(
    tmp_path: Path,
) -> None:
    async with make_integration_client(
        resume_parser=EmptyResumeParser(), resume_storage_dir=str(tmp_path)
    ) as client:
        upload = await client.post(
            "/resume-imports",
            files={"file": ("base.docx", resume_docx(), "application/octet-stream")},
        )
        assert upload.status_code == 201, upload.text
        version_id = upload.json()["resume_version_id"]

        response = await client.post(
            "/answer-engine/resolve",
            json={
                "selected_resume_version_id": version_id,
                "fields": [
                    field(
                        "resume",
                        canonical_key="RESUME_FILE",
                        question="Resume",
                        control_type="FILE",
                    )
                ],
            },
        )

        assert response.status_code == 200, response.text
        decision = response.json()["decisions"][0]
        assert decision["proposed_answer"] == "base.docx"
        assert decision["source_category"] == "RESUME_VERSION"
        assert decision["source_reference_id"] == version_id
        assert str(tmp_path) not in response.text


@pytest.mark.asyncio
async def test_foreign_resume_version_is_rejected(tmp_path: Path) -> None:
    first_id, second_id = uuid4(), uuid4()
    async with make_integration_client(user_id=first_id) as first:
        async with make_integration_client(
            user_id=second_id,
            resume_parser=EmptyResumeParser(),
            resume_storage_dir=str(tmp_path),
        ) as second:
            upload = await second.post(
                "/resume-imports",
                files={"file": ("foreign.docx", resume_docx(), "application/octet-stream")},
            )
            assert upload.status_code == 201
            response = await first.post(
                "/answer-engine/resolve",
                json={
                    "selected_resume_version_id": upload.json()["resume_version_id"],
                    "fields": [
                        field(
                            "resume",
                            canonical_key="RESUME_FILE",
                            question="Resume",
                            control_type="FILE",
                        )
                    ],
                },
            )

            assert response.status_code == 404


@pytest.mark.asyncio
async def test_semantic_classifier_only_suggests_non_sensitive_answers() -> None:
    classifier = FakeAnswerClassifier()
    async with make_integration_client(answer_classifier=classifier) as client:
        response = await client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    field("email", canonical_key=None, question="Electronic mail"),
                    field(
                        "veteran",
                        canonical_key=None,
                        question="Please select your veteran status",
                    ),
                ]
            },
        )

        assert response.status_code == 200, response.text
        decisions = {item["field_id"]: item for item in response.json()["decisions"]}
        assert classifier.field_ids == ["email"]
        assert decisions["email"]["canonical_key"] == "CONTACT_EMAIL"
        assert decisions["email"]["action"] == "SUGGEST"
        assert decisions["email"]["confidence"] == "MEDIUM"
        assert decisions["veteran"]["action"] == "ASK"
        assert decisions["veteran"]["reuse_policy"] == "PROHIBITED"
        assert response.json()["semantic_classifier_used"] is True


@pytest.mark.asyncio
async def test_semantic_classifier_failure_falls_back_to_unknown() -> None:
    async with make_integration_client(answer_classifier=FailingAnswerClassifier()) as client:
        response = await client.post(
            "/answer-engine/resolve",
            json={
                "fields": [
                    field(
                        "custom",
                        canonical_key=None,
                        question="Tell us something relevant",
                    )
                ]
            },
        )

        assert response.status_code == 200, response.text
        assert response.json()["semantic_classifier_used"] is False
        decision = response.json()["decisions"][0]
        assert decision["action"] == "ASK"
        assert decision["proposed_answer"] is None
        assert decision["source_category"] == "UNKNOWN"
