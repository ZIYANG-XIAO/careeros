"""M9 provider-neutral source boundary and ingestion behavior."""

from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest
from conftest import get_test_db_url, make_integration_client
from pydantic import ValidationError
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from careeros_api.job_schemas import ParsedJobDescription, ParsedJobRequirement
from careeros_api.job_sources import (
    NormalizedJobCandidate,
    SeedJobSourceAdapter,
    ingest_job_source,
)
from careeros_api.models import (
    JobAvailabilityStatus,
    JobCountry,
    JobEmploymentType,
    JobFreshnessStatus,
    JobMarket,
    JobRequirementCategory,
    JobRequirementImportance,
    JobWorkplaceType,
    RequirementConfidence,
)

pytestmark = pytest.mark.integration


class CountingJobParser:
    model = "m9-fake-parser"

    def __init__(self) -> None:
        self.calls = 0

    async def parse_job_description(self, job_description: str) -> object:
        self.calls += 1
        source = "Python experience required"
        return ParsedJobDescription(
            requirements=[
                ParsedJobRequirement(
                    category=JobRequirementCategory.SKILL,
                    description=source,
                    normalized_value="Python",
                    importance=JobRequirementImportance.REQUIRED,
                    source_text=source,
                    confidence=RequirementConfidence.HIGH,
                )
            ]
        )


def candidate(
    *,
    external_job_id: str = "job-123",
    description: str = "Build reliable services. Python experience required for this role.",
    observed_at: datetime | None = None,
) -> NormalizedJobCandidate:
    return NormalizedJobCandidate(
        external_job_id=external_job_id,
        company="Example Corp",
        title="Platform Engineer",
        location="Remote",
        description=description,
        source_url="https://jobs.example.com/roles/123",
        application_url="https://jobs.example.com/roles/123/apply",
        canonical_url="https://jobs.example.com/roles/123",
        observed_at=observed_at or datetime(2026, 9, 23, tzinfo=UTC),
        availability_status=JobAvailabilityStatus.AVAILABLE,
        freshness_status=JobFreshnessStatus.UNKNOWN,
        market=JobMarket.NORTH_AMERICA,
        country_code=JobCountry.US,
        workplace_type=JobWorkplaceType.REMOTE,
        employment_type=JobEmploymentType.FULL_TIME,
    )


@pytest.mark.asyncio
async def test_source_ingestion_is_retry_safe_and_visible_through_canonical_api() -> None:
    user_id = uuid4()
    brain_id = uuid4()
    parser = CountingJobParser()
    first_observed = datetime(2026, 9, 23, tzinfo=UTC)
    later_observed = first_observed + timedelta(hours=2)

    async with make_integration_client(
        user_id=user_id,
        brain_id=brain_id,
        job_parser=parser,
    ) as client:
        engine = create_async_engine(get_test_db_url(), pool_pre_ping=True)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as session:
                first = await ingest_job_source(
                    session,
                    user_id=user_id,
                    adapter=SeedJobSourceAdapter([candidate(observed_at=first_observed)]),
                    parser=parser,
                )
                await session.commit()
            async with factory() as session:
                retry = await ingest_job_source(
                    session,
                    user_id=user_id,
                    adapter=SeedJobSourceAdapter([candidate(observed_at=later_observed)]),
                    parser=parser,
                )
                await session.commit()
        finally:
            await engine.dispose()

        assert first.created_count == 1
        assert first.updated_count == 0
        assert retry.created_count == 0
        assert retry.updated_count == 1
        assert first.jobs[0].id == retry.jobs[0].id
        assert parser.calls == 1

        response = await client.get("/jobs", params={"source": "mine"})
        assert response.status_code == 200
        assert len(response.json()) == 1
        job = response.json()[0]
        assert job["source_type"] == "EXTERNAL_SOURCE"
        assert job["source_key"] == "demo"
        assert job["external_job_id"] == "job-123"
        assert job["canonical_url"] == "https://jobs.example.com/roles/123"
        assert job["availability_status"] == "AVAILABLE"
        assert job["freshness_status"] == "UNKNOWN"
        assert job["market"] == "NORTH_AMERICA"
        assert job["country_code"] == "US"
        assert job["workplace_type"] == "REMOTE"
        assert job["employment_type"] == "FULL_TIME"
        assert job["first_observed_at"] == first_observed.isoformat().replace("+00:00", "Z")
        assert job["last_observed_at"] == later_observed.isoformat().replace("+00:00", "Z")


@pytest.mark.asyncio
async def test_changed_source_description_adds_snapshot_without_duplicate_job() -> None:
    user_id = uuid4()
    brain_id = uuid4()
    parser = CountingJobParser()
    updated_description = (
        "Build reliable distributed systems. Python experience required for this role."
    )

    async with make_integration_client(
        user_id=user_id,
        brain_id=brain_id,
        job_parser=parser,
    ) as client:
        engine = create_async_engine(get_test_db_url(), pool_pre_ping=True)
        factory = async_sessionmaker(engine, expire_on_commit=False)
        try:
            async with factory() as session:
                await ingest_job_source(
                    session,
                    user_id=user_id,
                    adapter=SeedJobSourceAdapter([candidate()]),
                    parser=parser,
                )
                await session.commit()
            async with factory() as session:
                await ingest_job_source(
                    session,
                    user_id=user_id,
                    adapter=SeedJobSourceAdapter(
                        [
                            candidate(
                                external_job_id="replacement-provider-id",
                                description=updated_description,
                                observed_at=datetime(2026, 9, 24, tzinfo=UTC),
                            )
                        ]
                    ),
                    parser=parser,
                )
                await session.commit()
        finally:
            await engine.dispose()

        response = await client.get("/jobs", params={"source": "mine"})
        assert response.status_code == 200
        jobs = response.json()
        assert len(jobs) == 1
        assert jobs[0]["external_job_id"] == "replacement-provider-id"
        assert jobs[0]["latest_snapshot"]["version_number"] == 2
        assert jobs[0]["latest_snapshot"]["raw_description"] == updated_description
        assert parser.calls == 2


def test_normalized_candidate_requires_stable_identity_and_safe_urls() -> None:
    with pytest.raises(ValidationError):
        NormalizedJobCandidate(
            company="Example Corp",
            title="Engineer",
            description="Python experience required for this role.",
        )
    with pytest.raises(ValidationError):
        NormalizedJobCandidate(
            external_job_id="job-123",
            company="Example Corp",
            title="Engineer",
            description="Python experience required for this role.",
            application_url="javascript:alert(1)",
        )
    with pytest.raises(ValidationError):
        candidate(observed_at=datetime(2026, 9, 23))
