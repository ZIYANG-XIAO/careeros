"""Provider-neutral job-source contracts and canonical ingestion."""

from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime
from hashlib import sha256
from typing import Protocol
from uuid import UUID

from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import or_, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement

from careeros_api.job_parser import JOB_PARSER_VERSION, JobParser, JobParsingError
from careeros_api.job_requirements import (
    REQUIREMENTS_PARSED,
    REQUIREMENTS_PENDING,
    UNPARSED_VERSION,
)
from careeros_api.job_schemas import ParsedJobDescription, validate_job_grounding
from careeros_api.models import (
    Job,
    JobAvailabilityStatus,
    JobCountry,
    JobEmploymentType,
    JobFreshnessStatus,
    JobMarket,
    JobRequirement,
    JobSnapshot,
    JobSourceType,
    JobWorkplaceType,
)


class JobSourceIngestionError(ValueError):
    """Raised when a normalized source candidate cannot be safely ingested."""


class NormalizedJobCandidate(BaseModel):
    """The minimal provider-neutral job contract accepted by CareerOS."""

    model_config = ConfigDict(str_strip_whitespace=True)

    external_job_id: str | None = Field(default=None, min_length=1, max_length=500)
    company: str = Field(min_length=1, max_length=500)
    title: str = Field(min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=500)
    description: str = Field(min_length=20, max_length=100_000)
    source_url: AnyHttpUrl | None = None
    application_url: AnyHttpUrl | None = None
    canonical_url: AnyHttpUrl | None = None
    observed_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    posted_at: datetime | None = None
    availability_status: JobAvailabilityStatus = JobAvailabilityStatus.UNKNOWN
    freshness_status: JobFreshnessStatus = JobFreshnessStatus.UNKNOWN
    market: JobMarket = JobMarket.UNKNOWN
    country_code: JobCountry = JobCountry.UNKNOWN
    workplace_type: JobWorkplaceType = JobWorkplaceType.UNKNOWN
    employment_type: JobEmploymentType = JobEmploymentType.UNKNOWN

    @field_validator("observed_at")
    @classmethod
    def require_timezone(cls, value: datetime) -> datetime:
        if value.tzinfo is None or value.utcoffset() is None:
            raise ValueError("observed_at must include a timezone")
        return value

    @model_validator(mode="after")
    def require_stable_identity(self) -> "NormalizedJobCandidate":
        if self.external_job_id is None and self.canonical_url is None:
            raise ValueError("A normalized job requires an external ID or canonical URL")
        if self.market == JobMarket.UNKNOWN and self.country_code != JobCountry.UNKNOWN:
            raise ValueError("A known country requires a market")
        if self.market == JobMarket.NORTH_AMERICA and self.country_code == JobCountry.CN:
            raise ValueError("China is not part of the North America market")
        if self.market == JobMarket.CHINA and self.country_code in {
            JobCountry.US,
            JobCountry.CA,
        }:
            raise ValueError("US and Canada are not part of the China market")
        return self


class JobSourceAdapter(Protocol):
    """Narrow contract implemented by a single external job source."""

    source_key: str

    async def fetch_candidates(self) -> Sequence[NormalizedJobCandidate]: ...


class SeedJobSourceAdapter:
    """Deterministic formation adapter for demos, fixtures, and local validation."""

    source_key = "demo"

    def __init__(self, candidates: Sequence[NormalizedJobCandidate]) -> None:
        self._candidates = tuple(candidates)

    async def fetch_candidates(self) -> Sequence[NormalizedJobCandidate]:
        return self._candidates


@dataclass(frozen=True)
class JobSourceIngestionResult:
    jobs: tuple[Job, ...]
    created_count: int
    updated_count: int


def _normalize_description(value: str) -> str:
    return "\n".join(line.strip() for line in value.replace("\r\n", "\n").split("\n")).strip()


async def _parse_description(parser: JobParser | None, description: str) -> ParsedJobDescription:
    if parser is None:
        raise JobSourceIngestionError("A job parser is required unless requirements are deferred")
    try:
        raw_output = await parser.parse_job_description(description)
        parsed = ParsedJobDescription.model_validate(raw_output)
        validate_job_grounding(parsed, description)
        return parsed
    except (JobParsingError, ValueError) as error:
        raise JobSourceIngestionError(str(error)) from error


async def _append_snapshot(
    session: AsyncSession,
    job: Job,
    candidate: NormalizedJobCandidate,
    parser: JobParser | None,
    *,
    defer_requirements: bool,
) -> JobSnapshot:
    normalized = _normalize_description(candidate.description)
    parsed = None if defer_requirements else await _parse_description(parser, candidate.description)
    snapshot = JobSnapshot(
        job_id=job.id,
        version_number=max((item.version_number for item in job.snapshots), default=0) + 1,
        raw_description=candidate.description,
        normalized_description=normalized,
        content_sha256=sha256(normalized.encode()).hexdigest(),
        parser_version=JOB_PARSER_VERSION if parsed else UNPARSED_VERSION,
        parser_model=str(getattr(parser, "model", "unknown-provider")) if parsed else "none",
        requirements_status=REQUIREMENTS_PARSED if parsed else REQUIREMENTS_PENDING,
    )
    session.add(snapshot)
    await session.flush()
    for position, requirement in enumerate(parsed.requirements if parsed else []):
        session.add(
            JobRequirement(
                job_snapshot_id=snapshot.id,
                category=requirement.category.value,
                description=requirement.description,
                normalized_value=requirement.normalized_value,
                importance=requirement.importance.value,
                source_text=requirement.source_text,
                confidence=requirement.confidence.value,
                position=position,
            )
        )
    await session.flush()
    return snapshot


async def _find_existing_job(
    session: AsyncSession,
    *,
    user_id: UUID | None,
    source_key: str,
    candidate: NormalizedJobCandidate,
) -> Job | None:
    identities: list[ColumnElement[bool]] = []
    if candidate.external_job_id is not None:
        identities.append(
            (Job.source_key == source_key) & (Job.external_job_id == candidate.external_job_id)
        )
    if candidate.canonical_url is not None:
        identities.append(Job.canonical_url == str(candidate.canonical_url))
    result = await session.scalars(
        select(Job)
        .options(selectinload(Job.snapshots).selectinload(JobSnapshot.requirements))
        .where(
            Job.user_id.is_(None) if user_id is None else Job.user_id == user_id,
            or_(*identities),
        )
    )
    matches = result.unique().all()
    if len(matches) > 1:
        raise JobSourceIngestionError("Source identity resolves to multiple canonical jobs")
    return matches[0] if matches else None


async def ingest_job_source(
    session: AsyncSession,
    *,
    user_id: UUID | None,
    adapter: JobSourceAdapter,
    parser: JobParser | None,
    defer_requirements: bool = False,
) -> JobSourceIngestionResult:
    """Normalize one source into canonical Jobs, safely retryable.

    ``user_id=None`` ingests into the shared catalog. ``defer_requirements``
    stores snapshots as PENDING so requirement extraction happens on first use
    (see ``careeros_api.job_requirements``) instead of once per posting here.
    """

    source_key = adapter.source_key.strip().lower()
    if not source_key or len(source_key) > 100 or not source_key.replace("-", "").isalnum():
        raise JobSourceIngestionError("Invalid source key")

    jobs: list[Job] = []
    created_count = 0
    updated_count = 0
    for candidate in await adapter.fetch_candidates():
        existing = await _find_existing_job(
            session,
            user_id=user_id,
            source_key=source_key,
            candidate=candidate,
        )
        is_new = existing is None
        job = existing or Job(
            user_id=user_id,
            company=candidate.company,
            title=candidate.title,
            source_type=JobSourceType.EXTERNAL_SOURCE.value,
            source_key=source_key,
            first_observed_at=candidate.observed_at,
            last_observed_at=candidate.observed_at,
            snapshots=[],
        )
        job.company = candidate.company
        job.title = candidate.title
        job.location = candidate.location
        job.source_url = str(candidate.source_url) if candidate.source_url else None
        job.application_url = str(candidate.application_url) if candidate.application_url else None
        job.external_job_id = candidate.external_job_id
        job.canonical_url = str(candidate.canonical_url) if candidate.canonical_url else None
        job.availability_status = candidate.availability_status.value
        job.freshness_status = candidate.freshness_status.value
        job.market = candidate.market.value
        job.country_code = candidate.country_code.value
        job.workplace_type = candidate.workplace_type.value
        job.employment_type = candidate.employment_type.value
        if candidate.posted_at is not None:
            job.posted_at = candidate.posted_at
        if job.first_observed_at is None or candidate.observed_at < job.first_observed_at:
            job.first_observed_at = candidate.observed_at
        if job.last_observed_at is None or candidate.observed_at > job.last_observed_at:
            job.last_observed_at = candidate.observed_at
        if is_new:
            session.add(job)
            await session.flush()

        normalized_hash = sha256(_normalize_description(candidate.description).encode()).hexdigest()
        latest = max(job.snapshots, key=lambda item: item.version_number, default=None)
        if latest is None or latest.content_sha256 != normalized_hash:
            snapshot = await _append_snapshot(
                session, job, candidate, parser, defer_requirements=defer_requirements
            )
            job.snapshots.append(snapshot)

        jobs.append(job)
        created_count += int(is_new)
        updated_count += int(not is_new)

    await session.flush()
    return JobSourceIngestionResult(
        jobs=tuple(jobs),
        created_count=created_count,
        updated_count=updated_count,
    )


async def mark_unseen_catalog_jobs_unavailable(
    session: AsyncSession,
    *,
    source_key: str,
    external_id_prefix: str,
    seen_external_ids: set[str],
) -> int:
    """Mark catalog postings from one fully fetched feed that are gone as UNAVAILABLE.

    Call only after the feed was fetched and parsed successfully; a failed or
    partial fetch must never close postings. Returns how many were closed.
    """
    rows = await session.scalars(
        select(Job).where(
            Job.user_id.is_(None),
            Job.source_key == source_key,
            Job.external_job_id.startswith(external_id_prefix, autoescape=True),
            Job.availability_status != JobAvailabilityStatus.UNAVAILABLE.value,
        )
    )
    closed = 0
    for job in rows:
        if job.external_job_id not in seen_external_ids:
            job.availability_status = JobAvailabilityStatus.UNAVAILABLE.value
            job.freshness_status = JobFreshnessStatus.STALE.value
            closed += 1
    await session.flush()
    return closed
