"""Authenticated manual job capture and grounded parsing endpoints."""

import re
from datetime import UTC, datetime
from hashlib import sha256
from typing import Annotated
from urllib.parse import urlsplit, urlunsplit
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Query, Response, status
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field, field_validator, model_validator
from sqlalchemy import Integer, delete, exists, func, literal, or_, select
from sqlalchemy.dialects.postgresql import insert
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload
from sqlalchemy.sql.elements import ColumnElement

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.job_parser import JOB_PARSER_VERSION, JobParser, JobParsingError, get_job_parser
from careeros_api.job_ranking import goal_match_score
from careeros_api.job_requirements import (
    ParserUnavailableError,
    RequirementExtractionError,
    ensure_snapshot_requirements,
)
from careeros_api.job_salary import SalaryRange, salary_range
from careeros_api.job_schemas import ParsedJobDescription, validate_job_grounding
from careeros_api.job_sponsorship import SponsorshipStatement, sponsorship_statement
from careeros_api.job_urls import canonical_clip_url
from careeros_api.models import (
    Application,
    HiddenCompany,
    Job,
    JobAvailabilityStatus,
    JobCountry,
    JobDismissal,
    JobEmploymentType,
    JobFreshnessStatus,
    JobMarket,
    JobRequirement,
    JobSearchGoal,
    JobSnapshot,
    JobSourceType,
    JobWorkplaceType,
    SavedJob,
    User,
)
from careeros_api.rate_limit import ai_rate_limit

router = APIRouter(prefix="/jobs", tags=["jobs"])


def check_market_country(market: JobMarket, country: JobCountry) -> None:
    if market == JobMarket.UNKNOWN and country != JobCountry.UNKNOWN:
        raise ValueError("A known country requires a market")
    if market == JobMarket.NORTH_AMERICA and country == JobCountry.CN:
        raise ValueError("China is not part of the North America market")
    if market == JobMarket.CHINA and country in {JobCountry.US, JobCountry.CA}:
        raise ValueError("US and Canada are not part of the China market")


class CreateJobRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    company: str = Field(min_length=1, max_length=500)
    title: str = Field(min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=500)
    description: str = Field(min_length=20, max_length=100_000)
    source_url: AnyHttpUrl | None = None
    application_url: AnyHttpUrl | None = None
    market: JobMarket = JobMarket.UNKNOWN
    country_code: JobCountry = JobCountry.UNKNOWN
    workplace_type: JobWorkplaceType = JobWorkplaceType.UNKNOWN
    employment_type: JobEmploymentType = JobEmploymentType.UNKNOWN

    @field_validator("company", "title", "description")
    @classmethod
    def reject_blank(cls, value: str) -> str:
        if not value.strip():
            raise ValueError("Value must not be blank")
        return value.strip()

    @model_validator(mode="after")
    def validate_market_country(self) -> "CreateJobRequest":
        check_market_country(self.market, self.country_code)
        return self


CLIP_SOURCE_KEY = "extension_clip"
UNPAGED_CATALOG_CAP = 200
MAX_GROUPED_LOCATIONS = 20


class ClipJobRequest(CreateJobRequest):
    source_url: AnyHttpUrl


class UpdateJobRequest(BaseModel):
    """Editable listing fields. The description is an immutable snapshot."""

    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    company: str | None = Field(default=None, min_length=1, max_length=500)
    title: str | None = Field(default=None, min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=500)
    application_url: AnyHttpUrl | None = None
    market: JobMarket | None = None
    country_code: JobCountry | None = None
    workplace_type: JobWorkplaceType | None = None
    employment_type: JobEmploymentType | None = None


class JobRequirementResponse(BaseModel):
    id: UUID
    category: str
    description: str
    normalized_value: str | None
    importance: str
    source_text: str
    confidence: str
    position: int


class JobSnapshotResponse(BaseModel):
    id: UUID
    version_number: int
    raw_description: str
    normalized_description: str
    content_sha256: str
    parser_version: str
    parser_model: str
    requirements_status: str
    created_at: datetime
    requirements: list[JobRequirementResponse]


class JobResponse(BaseModel):
    id: UUID
    company: str
    title: str
    location: str | None
    source_url: str | None
    application_url: str | None
    source_type: str
    source_key: str
    external_job_id: str | None
    canonical_url: str | None
    first_observed_at: datetime | None
    last_observed_at: datetime | None
    availability_status: str
    freshness_status: str
    market: str
    country_code: str
    workplace_type: str
    employment_type: str
    captured_at: datetime
    created_at: datetime
    updated_at: datetime
    is_saved: bool
    saved_at: datetime | None
    is_catalog: bool
    # Only set by collapsed listings: other matching postings of the same
    # company and title, and (up to a cap) where they are.
    similar_count: int = 0
    other_locations: list[str] = Field(default_factory=list)
    # The status of the user's most recently updated application to this job,
    # so browse views can mark jobs already applied to. Only set by listings.
    application_status: str | None = None
    # Only set by diversified listings: this row's rank within its company
    # and how many matching rows that company has in total.
    company_rank: int | None = None
    company_job_count: int | None = None
    posted_at: datetime | None = None
    # What the posting itself says about visa sponsorship, quoted; None when
    # it says nothing. Never inferred (see job_sponsorship.py).
    sponsorship: SponsorshipStatement | None = None
    # The pay range the posting states, quoted; None when it states none.
    salary: SalaryRange | None = None
    latest_snapshot: JobSnapshotResponse


class ClipJobResponse(BaseModel):
    created: bool
    job: JobResponse


def job_parser_dependency() -> JobParser:
    try:
        return get_job_parser()
    except JobParsingError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE, detail=str(error)
        ) from error


def _normalize_description(value: str) -> str:
    return "\n".join(line.strip() for line in value.replace("\r\n", "\n").split("\n")).strip()


def _snapshot_response(snapshot: JobSnapshot) -> JobSnapshotResponse:
    return JobSnapshotResponse(
        id=snapshot.id,
        version_number=snapshot.version_number,
        raw_description=snapshot.raw_description,
        normalized_description=snapshot.normalized_description,
        content_sha256=snapshot.content_sha256,
        parser_version=snapshot.parser_version,
        parser_model=snapshot.parser_model,
        requirements_status=snapshot.requirements_status,
        created_at=snapshot.created_at,
        requirements=[
            JobRequirementResponse(
                id=item.id,
                category=item.category,
                description=item.description,
                normalized_value=item.normalized_value,
                importance=item.importance,
                source_text=item.source_text,
                confidence=item.confidence,
                position=item.position,
            )
            for item in sorted(snapshot.requirements, key=lambda requirement: requirement.position)
        ],
    )


def _job_response(
    job: Job, *, is_saved: bool = False, saved_at: datetime | None = None
) -> JobResponse:
    latest = max(job.snapshots, key=lambda snapshot: snapshot.version_number)
    return JobResponse(
        id=job.id,
        company=job.company,
        title=job.title,
        location=job.location,
        source_url=job.source_url,
        application_url=job.application_url,
        source_type=job.source_type,
        source_key=job.source_key,
        external_job_id=job.external_job_id,
        canonical_url=job.canonical_url,
        first_observed_at=job.first_observed_at,
        posted_at=job.posted_at,
        last_observed_at=job.last_observed_at,
        availability_status=job.availability_status,
        freshness_status=job.freshness_status,
        market=job.market,
        country_code=job.country_code,
        workplace_type=job.workplace_type,
        employment_type=job.employment_type,
        captured_at=job.captured_at,
        created_at=job.created_at,
        updated_at=job.updated_at,
        is_saved=is_saved,
        saved_at=saved_at,
        is_catalog=job.user_id is None,
        sponsorship=sponsorship_statement(latest.raw_description),
        salary=salary_range(latest.raw_description),
        latest_snapshot=_snapshot_response(latest),
    )


def visible_to(user_id: UUID) -> ColumnElement[bool]:
    """Jobs a user may read, save, analyze, or apply to: their own plus the catalog."""
    return or_(Job.user_id == user_id, Job.user_id.is_(None))


async def _visible_job(session: AsyncSession, job_id: UUID, user_id: UUID) -> Job | None:
    return await session.scalar(
        select(Job)
        .options(selectinload(Job.snapshots).selectinload(JobSnapshot.requirements))
        .where(Job.id == job_id, visible_to(user_id))
    )


async def _private_job(session: AsyncSession, job_id: UUID, user_id: UUID) -> Job | None:
    """Only the user's own jobs may be edited or deleted; catalog jobs are shared."""
    return await session.scalar(
        select(Job)
        .options(selectinload(Job.snapshots).selectinload(JobSnapshot.requirements))
        .where(Job.id == job_id, Job.user_id == user_id)
    )


async def _parse_grounded(parser: JobParser, description: str) -> ParsedJobDescription:
    try:
        raw_parser_output = await parser.parse_job_description(description)
        parsed = ParsedJobDescription.model_validate(raw_parser_output)
        validate_job_grounding(parsed, description)
    except (JobParsingError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "JOB_PARSING_FAILED", "message": str(error)},
        ) from error
    return parsed


async def _create_job_with_snapshot(
    session: AsyncSession,
    user: User,
    body: CreateJobRequest,
    parser: JobParser,
    parsed: ParsedJobDescription,
    *,
    source_key: str = "manual",
    canonical_url: str | None = None,
) -> Job:
    normalized = _normalize_description(body.description)
    observed_at = datetime.now(UTC)
    job = Job(
        user_id=user.id,
        company=body.company,
        title=body.title,
        location=body.location,
        source_url=str(body.source_url) if body.source_url else None,
        application_url=str(body.application_url) if body.application_url else None,
        source_type=JobSourceType.MANUAL_ENTRY.value,
        source_key=source_key,
        canonical_url=canonical_url,
        first_observed_at=observed_at,
        last_observed_at=observed_at,
        availability_status=JobAvailabilityStatus.UNKNOWN.value,
        freshness_status=JobFreshnessStatus.UNKNOWN.value,
        market=body.market.value,
        country_code=body.country_code.value,
        workplace_type=body.workplace_type.value,
        employment_type=body.employment_type.value,
    )
    session.add(job)
    await session.flush()
    snapshot = JobSnapshot(
        job_id=job.id,
        version_number=1,
        raw_description=body.description,
        normalized_description=normalized,
        content_sha256=sha256(body.description.encode()).hexdigest(),
        parser_version=JOB_PARSER_VERSION,
        parser_model=str(getattr(parser, "model", "deterministic-test-provider")),
    )
    session.add(snapshot)
    await session.flush()
    for position, requirement in enumerate(parsed.requirements):
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
    loaded = await _visible_job(session, job.id, user.id)
    if loaded is None:  # pragma: no cover - defensive invariant
        raise RuntimeError("Created job could not be loaded")
    return loaded


@router.post(
    "",
    response_model=JobResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(ai_rate_limit)],
)
async def create_job(
    body: CreateJobRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    parser: Annotated[JobParser, Depends(job_parser_dependency)],
) -> JobResponse:
    parsed = await _parse_grounded(parser, body.description)
    job = await _create_job_with_snapshot(session, user, body, parser, parsed)
    return _job_response(job)


async def _mark_saved(session: AsyncSession, user_id: UUID, job_id: UUID) -> datetime | None:
    await session.execute(
        insert(SavedJob)
        .values(user_id=user_id, job_id=job_id)
        .on_conflict_do_nothing(index_elements=["user_id", "job_id"])
    )
    await session.flush()
    return await session.scalar(
        select(SavedJob.created_at).where(SavedJob.user_id == user_id, SavedJob.job_id == job_id)
    )


@router.post("/clip", response_model=ClipJobResponse, dependencies=[Depends(ai_rate_limit)])
async def clip_job(
    body: ClipJobRequest,
    response: Response,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    parser: Annotated[JobParser, Depends(job_parser_dependency)],
) -> ClipJobResponse:
    """Save a user-confirmed job captured from the active page by the extension.

    Clipping the same page again returns the existing Job instead of creating a
    duplicate; the page URL is the stable identity.
    """
    canonical_url = canonical_clip_url(str(body.source_url))
    if canonical_url is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "UNSUPPORTED_URL", "message": "Only http(s) pages can be clipped"},
        )
    # A page already in the shared catalog is saved as that catalog job rather
    # than duplicated as a private copy. Prefer the user's own job if both exist.
    existing_id = await session.scalar(
        select(Job.id)
        .where(visible_to(user.id), Job.canonical_url == canonical_url)
        .order_by(Job.user_id.is_(None))
        .limit(1)
    )
    if existing_id is not None:
        existing = await _visible_job(session, existing_id, user.id)
        if existing is None:  # pragma: no cover - defensive invariant
            raise RuntimeError("Clipped job could not be loaded")
        saved_at = await _mark_saved(session, user.id, existing.id)
        response.status_code = status.HTTP_200_OK
        return ClipJobResponse(
            created=False, job=_job_response(existing, is_saved=True, saved_at=saved_at)
        )

    create_body = CreateJobRequest.model_validate(
        {
            **body.model_dump(exclude={"source_url"}),
            "source_url": body.source_url,
            "application_url": body.application_url or body.source_url,
        }
    )
    parsed = await _parse_grounded(parser, create_body.description)
    job = await _create_job_with_snapshot(
        session,
        user,
        create_body,
        parser,
        parsed,
        source_key=CLIP_SOURCE_KEY,
        canonical_url=canonical_url,
    )
    saved_at = await _mark_saved(session, user.id, job.id)
    response.status_code = status.HTTP_201_CREATED
    return ClipJobResponse(created=True, job=_job_response(job, is_saved=True, saved_at=saved_at))


DIVERSIFY_PER_COMPANY = 2


def _browse_conditions(
    user: User,
    *,
    search: str | None,
    location: str | None,
    company: str | None,
    saved_only: bool,
    market: JobMarket | None,
    country_code: JobCountry | None,
    workplace_type: JobWorkplaceType | None,
    employment_type: JobEmploymentType | None,
    source: str,
    include_hidden: bool,
) -> tuple[ColumnElement[bool], list[ColumnElement[bool]]]:
    """The saved-job join and the filters shared by job listings."""
    saved_join = (SavedJob.job_id == Job.id) & (SavedJob.user_id == user.id)
    conditions: list[ColumnElement[bool]] = [
        visible_to(user.id),
        # Closed catalog postings stay reachable only where the user saved them.
        or_(
            Job.user_id.is_not(None),
            Job.availability_status != JobAvailabilityStatus.UNAVAILABLE.value,
            SavedJob.id.is_not(None),
        ),
    ]
    if source == "mine":
        conditions.append(Job.user_id == user.id)
    elif source == "catalog":
        conditions.append(Job.user_id.is_(None))
    if search is not None:
        term = f"%{search.strip()}%"
        conditions.append(or_(Job.title.ilike(term), Job.company.ilike(term)))
    if company is not None:
        conditions.append(func.lower(func.trim(Job.company)) == company.strip().lower())
    if location is not None:
        conditions.append(Job.location.ilike(f"%{location.strip()}%"))
    if saved_only:
        conditions.append(SavedJob.id.is_not(None))
    if market is not None:
        conditions.append(Job.market == market.value)
    if country_code is not None:
        conditions.append(Job.country_code == country_code.value)
    if workplace_type is not None:
        conditions.append(Job.workplace_type == workplace_type.value)
    if employment_type is not None:
        conditions.append(Job.employment_type == employment_type.value)
    # Browse lists honour "not interested" and hidden companies; saved and
    # private lists never hide anything the user explicitly kept.
    if not include_hidden and not saved_only and source != "mine":
        conditions.append(
            ~exists().where(JobDismissal.user_id == user.id, JobDismissal.job_id == Job.id)
        )
        conditions.append(
            ~exists().where(
                HiddenCompany.user_id == user.id,
                HiddenCompany.company_key == func.lower(func.trim(Job.company)),
            )
        )

    return saved_join, conditions


@router.get("", response_model=list[JobResponse])
async def list_jobs(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    search: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    location: Annotated[str | None, Query(min_length=1, max_length=200)] = None,
    company: Annotated[str | None, Query(min_length=1, max_length=500)] = None,
    saved_only: bool = False,
    market: JobMarket | None = None,
    country_code: JobCountry | None = None,
    workplace_type: JobWorkplaceType | None = None,
    employment_type: JobEmploymentType | None = None,
    sort: str = Query(default="recent", pattern="^(recent|title|match)$"),
    diversify: bool = False,
    source: str = Query(default="all", pattern="^(all|mine|catalog)$"),
    limit: Annotated[int | None, Query(ge=1, le=200)] = None,
    offset: Annotated[int, Query(ge=0)] = 0,
    compact: bool = False,
    collapse: bool = False,
    include_hidden: bool = False,
) -> list[JobResponse]:
    """List visible jobs.

    ``compact`` omits descriptions and requirements, which list views never
    show; fetch ``/jobs/{id}`` for the full record. ``collapse`` shows one row
    per company and title (employers often post one role once per city); the
    row reports how many other matching postings it stands for and where.
    ``diversify`` keeps at most ``DIVERSIFY_PER_COMPANY`` rows per company
    (its most recent) so one employer's batch cannot fill a page; each row
    reports how many matching rows its company has in total.
    "recent" orders by when the employer published the posting, falling back
    to when CareerOS first saw it. "match" orders by fit with the user's active
    Job Search Goal (see job_ranking.py), then recency; without an active goal
    it is the same as "recent".
    """
    saved_join, conditions = _browse_conditions(
        user,
        search=search,
        location=location,
        company=company,
        saved_only=saved_only,
        market=market,
        country_code=country_code,
        workplace_type=workplace_type,
        employment_type=employment_type,
        source=source,
        include_hidden=include_hidden,
    )

    application_status = (
        select(Application.status)
        .where(Application.user_id == user.id, Application.job_id == Job.id)
        .order_by(Application.updated_at.desc())
        .limit(1)
        .scalar_subquery()
    )

    statement = (
        select(Job)
        .add_columns(
            SavedJob.id.is_not(None).label("is_saved"),
            SavedJob.created_at.label("saved_at"),
            application_status.label("application_status"),
        )
        .outerjoin(SavedJob, saved_join)
        .options(selectinload(Job.snapshots).selectinload(JobSnapshot.requirements))
    )
    recency = func.coalesce(Job.posted_at, Job.first_observed_at, Job.created_at)
    score: ColumnElement[int] = literal(0, type_=Integer)
    if sort == "match":
        goal = await session.scalar(
            select(JobSearchGoal)
            .where(JobSearchGoal.user_id == user.id, JobSearchGoal.is_active.is_(True))
            .order_by(JobSearchGoal.updated_at.desc())
            .limit(1)
        )
        if goal is not None:
            score = goal_match_score(goal)
    ranked = None
    if collapse:
        group = (Job.user_id, Job.company, func.lower(Job.title))
        ranked = (
            select(
                Job.id.label("id"),
                func.row_number()
                .over(
                    partition_by=group,
                    order_by=(SavedJob.id.is_(None), recency.desc(), Job.id),
                )
                .label("rank"),
                func.count().over(partition_by=group).label("group_size"),
                func.array_agg(Job.location).over(partition_by=group).label("group_locations"),
            )
            .select_from(Job)
            .outerjoin(SavedJob, saved_join)
            .where(*conditions)
            .subquery()
        )
        statement = (
            statement.add_columns(ranked.c.group_size, ranked.c.group_locations)
            .join(ranked, ranked.c.id == Job.id)
            .where(ranked.c.rank == 1)
        )
    else:
        statement = statement.where(*conditions)

    if diversify:
        candidates = (
            select(
                Job.id.label("id"),
                func.lower(func.trim(Job.company)).label("company_key"),
                recency.label("recency"),
                score.label("score"),
            )
            .select_from(Job)
            .outerjoin(SavedJob, saved_join)
            .where(*conditions)
        )
        if ranked is not None:
            candidates = candidates.join(ranked, ranked.c.id == Job.id).where(ranked.c.rank == 1)
        base = candidates.subquery()
        spread = (
            select(
                base.c.id,
                func.row_number()
                .over(
                    partition_by=base.c.company_key,
                    order_by=(base.c.score.desc(), base.c.recency.desc(), base.c.id),
                )
                .label("company_rank"),
                func.count().over(partition_by=base.c.company_key).label("company_total"),
            )
        ).subquery()
        statement = (
            statement.add_columns(spread.c.company_rank, spread.c.company_total)
            .join(spread, spread.c.id == Job.id)
            .where(spread.c.company_rank <= DIVERSIFY_PER_COMPANY)
        )

    if sort == "title":
        statement = statement.order_by(Job.title.asc(), Job.company.asc(), Job.id)
    else:
        statement = statement.order_by(score.desc(), recency.desc(), Job.id)
    # The shared catalog is large; unpaged requests for it are capped. Saved
    # and private lists stay complete because callers rely on them whole.
    if limit is None and not saved_only and source != "mine":
        limit = UNPAGED_CATALOG_CAP
    if limit is not None:
        statement = statement.limit(limit).offset(offset)

    responses: list[JobResponse] = []
    for row in (await session.execute(statement)).all():
        job, is_saved, saved_at = row[0], row[1], row[2]
        response = _job_response(job, is_saved=is_saved, saved_at=saved_at)
        response.application_status = row[3]
        extra = 4
        if collapse:
            group_size, group_locations = row[extra], row[extra + 1] or []
            response.similar_count = group_size - 1
            response.other_locations = _other_locations(job.location, group_locations)
            extra += 2
        if diversify:
            response.company_rank = row[extra]
            response.company_job_count = row[extra + 1]
        responses.append(response)
    if compact:
        for response in responses:
            snapshot = response.latest_snapshot
            snapshot.raw_description = ""
            snapshot.normalized_description = ""
            snapshot.requirements = []
    return responses


def _other_locations(own: str | None, locations: list[str | None]) -> list[str]:
    seen = {own} if own else set()
    others: list[str] = []
    for item in locations:
        if item and item not in seen:
            seen.add(item)
            others.append(item)
    return others[:MAX_GROUPED_LOCATIONS]


_APPLY_SUFFIX = re.compile(r"/(apply|application|applications|apply-now)/?$", re.IGNORECASE)


def _lookup_candidates(url: str) -> list[str]:
    """The page's canonical URL, plus the posting URL an apply page belongs to."""
    canonical = canonical_clip_url(url)
    if canonical is None:
        return []
    candidates = [canonical, url]
    parts = urlsplit(canonical)
    stripped = _APPLY_SUFFIX.sub("", parts.path)
    if stripped != parts.path:
        candidates.append(urlunsplit((parts.scheme, parts.netloc, stripped, parts.query, "")))
    return candidates


@router.get("/lookup", response_model=JobResponse)
async def lookup_job(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    url: Annotated[str, Query(min_length=8, max_length=2000)],
) -> JobResponse:
    """The CareerOS job (own or catalog) whose posting is the given page.

    Lets the extension show a job card on a posting or its apply page without
    the user re-saving it. Matching is by canonical URL only — never fuzzy.
    """
    candidates = _lookup_candidates(url)
    if not candidates:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    saved_join = (SavedJob.job_id == Job.id) & (SavedJob.user_id == user.id)
    row = (
        await session.execute(
            select(Job, SavedJob.id.is_not(None), SavedJob.created_at)
            .outerjoin(SavedJob, saved_join)
            .options(selectinload(Job.snapshots).selectinload(JobSnapshot.requirements))
            .where(
                visible_to(user.id),
                or_(
                    Job.canonical_url.in_(candidates),
                    Job.source_url.in_(candidates),
                    Job.application_url.in_(candidates),
                ),
            )
            # Prefer the user's own copy, then the most recently seen posting.
            .order_by(Job.user_id.is_(None), Job.last_observed_at.desc().nulls_last())
            .limit(1)
        )
    ).one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    job, is_saved, saved_at = row
    return _job_response(job, is_saved=is_saved, saved_at=saved_at)


@router.get("/{job_id}", response_model=JobResponse)
async def get_job(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> JobResponse:
    result = await session.execute(
        select(Job)
        .add_columns(
            SavedJob.id.is_not(None).label("is_saved"),
            SavedJob.created_at.label("saved_at"),
        )
        .outerjoin(
            SavedJob,
            (SavedJob.job_id == Job.id) & (SavedJob.user_id == user.id),
        )
        .options(selectinload(Job.snapshots).selectinload(JobSnapshot.requirements))
        .where(Job.id == job_id, visible_to(user.id))
    )
    row = result.one_or_none()
    if row is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    job, is_saved, saved_at = row
    return _job_response(job, is_saved=is_saved, saved_at=saved_at)


@router.post("/{job_id}/save", response_model=JobResponse)
async def save_job(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> JobResponse:
    job = await _visible_job(session, job_id, user.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    saved_at = await _mark_saved(session, user.id, job.id)
    return _job_response(job, is_saved=True, saved_at=saved_at)


@router.delete("/{job_id}/save", status_code=status.HTTP_204_NO_CONTENT)
async def unsave_job(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Response:
    job = await _visible_job(session, job_id, user.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    await session.execute(
        delete(SavedJob).where(SavedJob.user_id == user.id, SavedJob.job_id == job.id)
    )
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.patch("/{job_id}", response_model=JobResponse)
async def update_job(
    job_id: UUID,
    body: UpdateJobRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> JobResponse:
    job = await _private_job(session, job_id, user.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    changes = body.model_dump(exclude_unset=True)
    for required in ("company", "title"):
        if required in changes and changes[required] is None:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail={"code": "INVALID_JOB", "message": f"{required} cannot be empty"},
            )
    market = changes.get("market", JobMarket(job.market))
    country = changes.get("country_code", JobCountry(job.country_code))
    try:
        check_market_country(market, country)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_JOB", "message": str(error)},
        ) from error
    for field, value in changes.items():
        if field == "application_url":
            value = str(value) if value else None
        elif hasattr(value, "value"):
            value = value.value
        setattr(job, field, value)
    await session.flush()
    await session.refresh(job, ["updated_at"])
    saved_at = await session.scalar(
        select(SavedJob.created_at).where(SavedJob.user_id == user.id, SavedJob.job_id == job.id)
    )
    return _job_response(job, is_saved=saved_at is not None, saved_at=saved_at)


@router.delete("/{job_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_job(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Response:
    """Delete a job and its snapshots/analyses.

    Applications to it are kept: they carry their own company/role snapshot and
    simply lose the link to the Job.
    """
    result = await session.execute(delete(Job).where(Job.id == job_id, Job.user_id == user.id))
    if getattr(result, "rowcount", 0) == 0:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post(
    "/{job_id}/requirements",
    response_model=JobResponse,
    dependencies=[Depends(ai_rate_limit)],
)
async def extract_job_requirements(
    job_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    parser: Annotated[JobParser, Depends(job_parser_dependency)],
) -> JobResponse:
    """Extract grounded requirements for a job whose latest snapshot is pending.

    Catalog jobs defer this until someone needs it; the result is shared.
    Idempotent: an already-parsed snapshot is returned unchanged.
    """
    job = await _visible_job(session, job_id, user.id)
    if job is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Job not found")
    latest = max(job.snapshots, key=lambda snapshot: snapshot.version_number)
    try:
        changed = await ensure_snapshot_requirements(session, latest.id, parser)
    except (RequirementExtractionError, ParserUnavailableError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "JOB_PARSING_FAILED", "message": str(error)},
        ) from error
    if changed:
        await session.refresh(latest, ["requirements", "requirements_status"])
    saved_at = await session.scalar(
        select(SavedJob.created_at).where(SavedJob.user_id == user.id, SavedJob.job_id == job.id)
    )
    return _job_response(job, is_saved=saved_at is not None, saved_at=saved_at)
