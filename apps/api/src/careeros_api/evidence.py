"""Career evidence lifecycle service.

Manages the creation, update, and deletion of CareerEvidence records and
their immutable CareerEvidenceRevision history.
"""

from uuid import UUID

import sqlalchemy as sa
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm.attributes import set_committed_value

from careeros_api.models import (
    CareerEvidence,
    CareerEvidenceRevision,
    ConfirmationStatus,
    CreatedBy,
    EvidenceOrigin,
    SourceType,
)


async def create_evidence(
    session: AsyncSession,
    career_brain_id: UUID,
    source_type: SourceType,
    source_id: UUID,
    content: str,
) -> CareerEvidence:
    """Create a CareerEvidence with its first revision.

    Must be called within the same transaction as the source entity creation
    so that partial state is impossible.
    """
    evidence = CareerEvidence(
        career_brain_id=career_brain_id,
        source_type=source_type.value,
        source_id=source_id,
    )
    session.add(evidence)
    await session.flush()

    revision = CareerEvidenceRevision(
        evidence_id=evidence.id,
        revision_number=1,
        content=content,
        origin=EvidenceOrigin.USER_ENTERED.value,
        confirmation_status=ConfirmationStatus.CONFIRMED.value,
        created_by=CreatedBy.USER.value,
    )
    session.add(revision)
    await session.flush()

    evidence.current_revision_id = revision.id
    # Populate the viewonly relationship in-memory to avoid a lazy load
    # (which would fail in an async context with MissingGreenlet).
    set_committed_value(evidence, "current_revision", revision)
    return evidence


async def update_evidence_content(
    session: AsyncSession,
    source_type: SourceType,
    source_id: UUID,
    new_content: str,
) -> CareerEvidenceRevision:
    """Append a new revision to the evidence for the given source and advance
    the current_revision_id pointer.  The previous revision is never mutated.
    """
    # Lock the evidence row to serialize concurrent revision appends.
    result = await session.execute(
        select(CareerEvidence)
        .where(
            CareerEvidence.source_type == source_type.value,
            CareerEvidence.source_id == source_id,
        )
        .with_for_update()
    )
    evidence = result.scalar_one()

    max_rev = await session.execute(
        select(sa.func.max(CareerEvidenceRevision.revision_number)).where(
            CareerEvidenceRevision.evidence_id == evidence.id
        )
    )
    current_max: int = max_rev.scalar_one() or 0

    revision = CareerEvidenceRevision(
        evidence_id=evidence.id,
        revision_number=current_max + 1,
        content=new_content,
        origin=EvidenceOrigin.USER_ENTERED.value,
        confirmation_status=ConfirmationStatus.CONFIRMED.value,
        created_by=CreatedBy.USER.value,
    )
    session.add(revision)
    await session.flush()

    evidence.current_revision_id = revision.id
    return revision


async def delete_evidence_for_source(
    session: AsyncSession,
    source_type: SourceType,
    source_id: UUID,
) -> None:
    """Delete the CareerEvidence and all its revisions for a single source.

    M1B deletion policy: evidence-bearing source entities cascade-delete
    their evidence and revision history.  This policy may evolve once
    Application Memory references evidence revisions.
    """
    result = await session.execute(
        select(CareerEvidence.id).where(
            CareerEvidence.source_type == source_type.value,
            CareerEvidence.source_id == source_id,
        )
    )
    evidence_id = result.scalar_one_or_none()
    if evidence_id is None:
        return

    # Clear current_revision_id, then delete revisions, then evidence.
    await session.execute(
        sa.update(CareerEvidence)
        .where(CareerEvidence.id == evidence_id)
        .values(current_revision_id=None)
    )
    await session.execute(
        sa.delete(CareerEvidenceRevision).where(CareerEvidenceRevision.evidence_id == evidence_id)
    )
    await session.execute(sa.delete(CareerEvidence).where(CareerEvidence.id == evidence_id))


async def delete_evidence_for_sources(
    session: AsyncSession,
    source_type: SourceType,
    source_ids: list[UUID],
) -> None:
    """Bulk-delete evidence for multiple source entities of the same type."""
    if not source_ids:
        return

    result = await session.execute(
        select(CareerEvidence.id).where(
            CareerEvidence.source_type == source_type.value,
            CareerEvidence.source_id.in_(source_ids),
        )
    )
    evidence_ids = [row[0] for row in result.all()]
    if not evidence_ids:
        return

    await session.execute(
        sa.update(CareerEvidence)
        .where(CareerEvidence.id.in_(evidence_ids))
        .values(current_revision_id=None)
    )
    await session.execute(
        sa.delete(CareerEvidenceRevision).where(
            CareerEvidenceRevision.evidence_id.in_(evidence_ids)
        )
    )
    await session.execute(sa.delete(CareerEvidence).where(CareerEvidence.id.in_(evidence_ids)))
