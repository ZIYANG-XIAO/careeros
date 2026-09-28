"""Deferred, shared requirement extraction for job snapshots.

Catalog snapshots are stored with ``requirements_status = PENDING`` so syncing
thousands of postings costs no AI calls. The first user who needs a snapshot's
requirements triggers extraction; the result is stored on the snapshot and so
shared by everyone. Identical descriptions reuse an existing parse.
"""

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from careeros_api.job_parser import JOB_PARSER_VERSION, JobParser, JobParsingError
from careeros_api.job_schemas import ParsedJobDescription, validate_job_grounding
from careeros_api.models import JobRequirement, JobSnapshot

REQUIREMENTS_PENDING = "PENDING"
REQUIREMENTS_PARSED = "PARSED"
UNPARSED_VERSION = "unparsed"


class RequirementExtractionError(ValueError):
    """The provider output was missing, invalid, or not grounded in the text."""


class ParserUnavailableError(RuntimeError):
    """Extraction is needed but no job parser is configured."""


async def ensure_snapshot_requirements(
    session: AsyncSession,
    snapshot_id: object,
    parser: JobParser | None,
) -> bool:
    """Extract requirements for a PENDING snapshot. Returns True if work was done.

    The snapshot row is locked so concurrent requests never extract twice.
    """
    snapshot = await session.scalar(
        select(JobSnapshot).where(JobSnapshot.id == snapshot_id).with_for_update()
    )
    if snapshot is None or snapshot.requirements_status == REQUIREMENTS_PARSED:
        return False

    donor = await session.scalar(
        select(JobSnapshot)
        .options(selectinload(JobSnapshot.requirements))
        .where(
            JobSnapshot.content_sha256 == snapshot.content_sha256,
            JobSnapshot.requirements_status == REQUIREMENTS_PARSED,
            JobSnapshot.parser_version == JOB_PARSER_VERSION,
            JobSnapshot.id != snapshot.id,
        )
        .limit(1)
    )
    if donor is not None and donor.requirements:
        rows = [
            (
                item.category,
                item.description,
                item.normalized_value,
                item.importance,
                item.source_text,
                item.confidence,
            )
            for item in sorted(donor.requirements, key=lambda item: item.position)
        ]
        parser_model = donor.parser_model
    else:
        if parser is None:
            raise ParserUnavailableError("Job requirement extraction is not configured")
        try:
            raw = await parser.parse_job_description(snapshot.raw_description)
            parsed = ParsedJobDescription.model_validate(raw)
            validate_job_grounding(parsed, snapshot.raw_description)
        except (JobParsingError, ValueError) as error:
            raise RequirementExtractionError(str(error)) from error
        rows = [
            (
                item.category.value,
                item.description,
                item.normalized_value,
                item.importance.value,
                item.source_text,
                item.confidence.value,
            )
            for item in parsed.requirements
        ]
        parser_model = str(getattr(parser, "model", "unknown-provider"))

    for position, (category, description, value, importance, source, confidence) in enumerate(rows):
        session.add(
            JobRequirement(
                job_snapshot_id=snapshot.id,
                category=category,
                description=description,
                normalized_value=value,
                importance=importance,
                source_text=source,
                confidence=confidence,
                position=position,
            )
        )
    snapshot.requirements_status = REQUIREMENTS_PARSED
    snapshot.parser_version = JOB_PARSER_VERSION
    snapshot.parser_model = parser_model
    await session.flush()
    return True
