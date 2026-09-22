from io import BytesIO
from pathlib import Path
from uuid import UUID, uuid4

import pytest
from conftest import make_integration_client
from docx import Document

from careeros_api.job_intelligence_schemas import (
    EvidenceInput,
    MatchEvaluation,
    MatchEvaluationBatch,
    RequirementInput,
    classify_match,
    validate_match_evaluations,
)
from careeros_api.job_schemas import ParsedJobDescription, ParsedJobRequirement
from careeros_api.models import (
    EvidenceSupportStrength,
    JobRequirementCategory,
    JobRequirementImportance,
    RequirementConfidence,
    ResumeRepresentation,
)
from careeros_api.resume_schemas import ParsedResumeDraft, ParsedSkill

pytestmark = pytest.mark.integration


JOB_DESCRIPTION = """Kafka experience required.
Kubernetes experience preferred.
GCP production experience required."""


class FakeResumeParser:
    async def parse_resume_to_career_draft(self, resume_text: str) -> ParsedResumeDraft:
        return ParsedResumeDraft(skills=[ParsedSkill(name="Python", source_text="Python")])


class FakeJobParser:
    model = "fake-job-parser"

    async def parse_job_description(self, job_description: str) -> ParsedJobDescription:
        definitions = (
            ("Kafka", "Kafka experience required.", JobRequirementImportance.REQUIRED),
            (
                "Kubernetes",
                "Kubernetes experience preferred.",
                JobRequirementImportance.PREFERRED,
            ),
            (
                "GCP",
                "GCP production experience required.",
                JobRequirementImportance.REQUIRED,
            ),
        )
        return ParsedJobDescription(
            requirements=[
                ParsedJobRequirement(
                    category=JobRequirementCategory.SKILL,
                    description=source,
                    normalized_value=name,
                    importance=importance,
                    source_text=source,
                    confidence=RequirementConfidence.HIGH,
                )
                for name, source, importance in definitions
            ]
        )


class FakeJobMatcher:
    model = "fake-job-matcher"

    def __init__(self, foreign_revision: UUID | None = None) -> None:
        self.foreign_revision = foreign_revision
        self.candidate_count = 0

    async def analyze_job_requirements(
        self,
        requirements: list[RequirementInput],
        evidence: list[EvidenceInput],
        resume_text: str,
    ) -> MatchEvaluationBatch:
        self.candidate_count = len(evidence)
        by_content = {item.content: item for item in evidence}
        matches: list[MatchEvaluation] = []
        for requirement in requirements:
            if requirement.normalized_value == "Kafka":
                revision_id = self.foreign_revision or next(
                    item.revision_id for item in evidence if "Kafka" in item.content
                )
                matches.append(
                    MatchEvaluation(
                        requirement_id=requirement.id,
                        support_strength=EvidenceSupportStrength.STRONG,
                        resume_representation=ResumeRepresentation.ABSENT,
                        evidence_revision_ids=[revision_id],
                        explanation=(
                            "Confirmed Kafka evidence exists but is absent from the resume."
                        ),
                    )
                )
            elif requirement.normalized_value == "Kubernetes":
                matches.append(
                    MatchEvaluation(
                        requirement_id=requirement.id,
                        support_strength=EvidenceSupportStrength.WEAK,
                        resume_representation=ResumeRepresentation.ABSENT,
                        evidence_revision_ids=[by_content["Docker"].revision_id],
                        explanation="Docker is adjacent deployment evidence, not Kubernetes proof.",
                    )
                )
            else:
                matches.append(
                    MatchEvaluation(
                        requirement_id=requirement.id,
                        support_strength=EvidenceSupportStrength.NONE_OR_INSUFFICIENT,
                        resume_representation=ResumeRepresentation.ABSENT,
                        evidence_revision_ids=[],
                        explanation="No confirmed GCP evidence exists.",
                    )
                )
        return MatchEvaluationBatch(matches=matches)


def resume_docx() -> bytes:
    document = Document()
    document.add_paragraph("Backend engineer with Python experience")
    buffer = BytesIO()
    document.save(buffer)
    return buffer.getvalue()


async def create_resume_and_evidence(client: object) -> tuple[str, str]:
    upload = await client.post(  # type: ignore[attr-defined]
        "/resume-imports",
        files={"file": ("base.docx", resume_docx(), "application/octet-stream")},
    )
    assert upload.status_code == 201
    await client.post(f"/resume-imports/{upload.json()['id']}/confirm")  # type: ignore[attr-defined]
    kafka = await client.post("/career-brain/skills", json={"name": "Kafka"})  # type: ignore[attr-defined]
    await client.post("/career-brain/skills", json={"name": "Docker"})  # type: ignore[attr-defined]
    return upload.json()["resume_version_id"], kafka.json()["id"]


async def create_job(client: object) -> str:
    response = await client.post(  # type: ignore[attr-defined]
        "/jobs",
        json={
            "company": "Example Corp",
            "title": "Platform Engineer",
            "description": JOB_DESCRIPTION,
        },
    )
    assert response.status_code == 201, response.text
    return response.json()["id"]


@pytest.mark.parametrize(
    ("support", "representation", "expected"),
    [
        ("STRONG", "REPRESENTED", "STRONG_EVIDENCE"),
        ("STRONG", "UNDERREPRESENTED", "HIDDEN_EVIDENCE"),
        ("STRONG", "ABSENT", "HIDDEN_EVIDENCE"),
        ("WEAK", "REPRESENTED", "WEAK_EVIDENCE"),
        ("WEAK", "UNDERREPRESENTED", "WEAK_EVIDENCE"),
        ("WEAK", "ABSENT", "WEAK_EVIDENCE"),
        ("NONE_OR_INSUFFICIENT", "REPRESENTED", "GENUINE_GAP"),
        ("NONE_OR_INSUFFICIENT", "UNDERREPRESENTED", "GENUINE_GAP"),
        ("NONE_OR_INSUFFICIENT", "ABSENT", "GENUINE_GAP"),
    ],
)
def test_complete_classification_matrix(support: str, representation: str, expected: str) -> None:
    assert (
        classify_match(EvidenceSupportStrength(support), ResumeRepresentation(representation)).value
        == expected
    )


def test_unsupported_named_technology_cannot_be_strongly_inferred() -> None:
    requirement_id, evidence_id, revision_id = uuid4(), uuid4(), uuid4()
    requirements = [
        RequirementInput(
            id=requirement_id,
            category="SKILL",
            description="Kafka required",
            normalized_value="Kafka",
            importance="REQUIRED",
        )
    ]
    evidence = [
        EvidenceInput(
            evidence_id=evidence_id,
            revision_id=revision_id,
            source_type="SKILL",
            content="Docker",
        )
    ]
    batch = MatchEvaluationBatch(
        matches=[
            MatchEvaluation(
                requirement_id=requirement_id,
                support_strength=EvidenceSupportStrength.STRONG,
                resume_representation=ResumeRepresentation.ABSENT,
                evidence_revision_ids=[revision_id],
                explanation="Invalid adjacent technology inference.",
            )
        ]
    )
    with pytest.raises(ValueError, match="direct evidence"):
        validate_match_evaluations(batch, requirements, evidence, "Python")


@pytest.mark.asyncio
async def test_analysis_strong_weak_gap_hidden_and_history(tmp_path: Path) -> None:
    matcher = FakeJobMatcher()
    async with make_integration_client(
        resume_parser=FakeResumeParser(),
        job_parser=FakeJobParser(),
        job_matcher=matcher,
        resume_storage_dir=str(tmp_path),
    ) as client:
        resume_version_id, kafka_skill_id = await create_resume_and_evidence(client)
        job_id = await create_job(client)
        created = await client.post(
            f"/jobs/{job_id}/analyses", json={"resume_version_id": resume_version_id}
        )
        assert created.status_code == 201, created.text
        analysis = created.json()
        assert matcher.candidate_count == 3
        by_value = {item["normalized_value"]: item for item in analysis["matches"]}
        assert by_value["Kafka"]["classification"] == "HIDDEN_EVIDENCE"
        assert by_value["Kafka"]["support_strength"] == "STRONG"
        assert by_value["Kubernetes"]["classification"] == "WEAK_EVIDENCE"
        assert by_value["GCP"]["classification"] == "GENUINE_GAP"
        assert by_value["Kafka"]["evidence_references"][0]["evidence_content"] == "Kafka"
        old_revision = by_value["Kafka"]["evidence_references"][0]["career_evidence_revision_id"]

        updated = await client.patch(
            f"/career-brain/skills/{kafka_skill_id}", json={"name": "Kafka Streams"}
        )
        assert updated.status_code == 200
        historical = await client.get(f"/jobs/{job_id}/analyses/{analysis['id']}")
        old_kafka = next(
            item for item in historical.json()["matches"] if item["normalized_value"] == "Kafka"
        )
        assert old_kafka["evidence_references"][0]["evidence_content"] == "Kafka"
        assert old_kafka["evidence_references"][0]["career_evidence_revision_id"] == old_revision

        second = await client.post(
            f"/jobs/{job_id}/analyses", json={"resume_version_id": resume_version_id}
        )
        assert second.status_code == 201
        second_kafka = next(
            item for item in second.json()["matches"] if item["normalized_value"] == "Kafka"
        )
        assert second.json()["analysis_version"] == 2
        assert second_kafka["evidence_references"][0]["evidence_content"] == "Kafka Streams"
        assert second_kafka["evidence_references"][0]["career_evidence_revision_id"] != old_revision


@pytest.mark.asyncio
async def test_foreign_evidence_reference_is_rejected(tmp_path: Path) -> None:
    matcher = FakeJobMatcher(foreign_revision=uuid4())
    async with make_integration_client(
        resume_parser=FakeResumeParser(),
        job_parser=FakeJobParser(),
        job_matcher=matcher,
        resume_storage_dir=str(tmp_path),
    ) as client:
        resume_version_id, _ = await create_resume_and_evidence(client)
        job_id = await create_job(client)
        response = await client.post(
            f"/jobs/{job_id}/analyses", json={"resume_version_id": resume_version_id}
        )
        assert response.status_code == 422
        assert "outside the candidate set" in response.text


@pytest.mark.asyncio
async def test_analysis_and_resume_ownership_isolation(tmp_path: Path) -> None:
    matcher = FakeJobMatcher()
    async with make_integration_client(
        resume_parser=FakeResumeParser(),
        job_parser=FakeJobParser(),
        job_matcher=matcher,
        resume_storage_dir=str(tmp_path / "owner"),
    ) as owner:
        resume_version_id, _ = await create_resume_and_evidence(owner)
        job_id = await create_job(owner)
        analysis = await owner.post(
            f"/jobs/{job_id}/analyses", json={"resume_version_id": resume_version_id}
        )
        async with make_integration_client(
            resume_parser=FakeResumeParser(),
            job_parser=FakeJobParser(),
            job_matcher=FakeJobMatcher(),
            resume_storage_dir=str(tmp_path / "other"),
        ) as other:
            hidden_analysis = await other.get(f"/jobs/{job_id}/analyses/{analysis.json()['id']}")
            assert hidden_analysis.status_code == 404
            other_job = await create_job(other)
            cross_resume = await other.post(
                f"/jobs/{other_job}/analyses", json={"resume_version_id": resume_version_id}
            )
            assert cross_resume.status_code == 404
