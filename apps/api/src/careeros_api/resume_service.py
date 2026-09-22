"""Resume ingestion, draft review, and confirmation domain service."""

import json
from datetime import UTC, datetime
from hashlib import sha256
from pathlib import Path
from typing import Any
from uuid import UUID, uuid4

from sqlalchemy import func, select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from careeros_api.evidence import append_evidence_revision, create_evidence
from careeros_api.models import (
    CareerEvidence,
    ConfirmationStatus,
    CreatedBy,
    Education,
    EvidenceOrigin,
    Experience,
    ExperienceDetail,
    Project,
    ProjectDetail,
    Resume,
    ResumeAsset,
    ResumeDraftItem,
    ResumeDraftItemStatus,
    ResumeDraftItemType,
    ResumeImport,
    ResumeImportStatus,
    ResumeType,
    ResumeVersion,
    ResumeVersionSource,
    Skill,
    SourceType,
    User,
)
from careeros_api.resume_parser import PARSER_VERSION
from careeros_api.resume_schemas import (
    ParsedDetail,
    ParsedEducation,
    ParsedExperience,
    ParsedProject,
    ParsedResumeDraft,
    ParsedSkill,
)


class ResumeStateError(ValueError):
    pass


def _canonical_json(data: dict[str, object]) -> str:
    return json.dumps(data, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def _safe_original_filename(filename: str) -> str:
    basename = filename.replace("\\", "/").rsplit("/", 1)[-1]
    cleaned = "".join(
        character for character in basename if character.isprintable() and character != "\x00"
    )
    return cleaned[:500] or "resume"


def _draft_schema(item_type: str) -> type[Any]:
    schemas: dict[str, type[Any]] = {
        ResumeDraftItemType.EDUCATION.value: ParsedEducation,
        ResumeDraftItemType.EXPERIENCE.value: ParsedExperience,
        ResumeDraftItemType.EXPERIENCE_DETAIL.value: ParsedDetail,
        ResumeDraftItemType.PROJECT.value: ParsedProject,
        ResumeDraftItemType.PROJECT_DETAIL.value: ParsedDetail,
        ResumeDraftItemType.SKILL.value: ParsedSkill,
    }
    return schemas[item_type]


def validate_draft_data(item_type: str, data: dict[str, object]) -> dict[str, object]:
    validated = _draft_schema(item_type).model_validate(data)
    result: dict[str, object] = validated.model_dump(exclude={"details"})
    return result


async def create_resume_import(
    session: AsyncSession,
    user: User,
    *,
    filename: str,
    content_type: str,
    storage_key: str,
    data: bytes,
    extracted_text: str,
    draft: ParsedResumeDraft,
) -> ResumeImport:
    existing_count = await session.scalar(
        select(func.count(Resume.id)).where(Resume.user_id == user.id)
    )
    safe_filename = _safe_original_filename(filename)
    display_name = Path(safe_filename).stem.strip()[:500] or "Uploaded resume"
    resume = Resume(
        user_id=user.id,
        name=display_name,
        type=ResumeType.BASE.value,
        is_primary=(existing_count == 0),
    )
    session.add(resume)
    await session.flush()

    asset = ResumeAsset(
        user_id=user.id,
        storage_key=storage_key,
        original_filename=safe_filename,
        content_type=content_type,
        size_bytes=len(data),
        sha256=sha256(data).hexdigest(),
    )
    session.add(asset)
    await session.flush()

    version = ResumeVersion(
        resume_id=resume.id,
        asset_id=asset.id,
        version_number=1,
        source=ResumeVersionSource.UPLOADED.value,
        created_by=CreatedBy.USER.value,
        source_version_id=None,
        extracted_text=extracted_text,
        structured_content=draft.model_dump(mode="json"),
        parser_version=PARSER_VERSION,
    )
    session.add(version)
    await session.flush()

    resume_import = ResumeImport(
        user_id=user.id,
        career_brain_id=user.career_brain.id,
        resume_version_id=version.id,
        status=ResumeImportStatus.PROCESSING.value,
    )
    session.add(resume_import)
    await session.flush()

    position = 0

    async def add_item(
        item_type: ResumeDraftItemType,
        item_data: dict[str, object],
        parent_id: UUID | None = None,
    ) -> ResumeDraftItem:
        nonlocal position
        position += 1
        item_id = uuid4()
        normalized = validate_draft_data(item_type.value, item_data)
        evidence = await create_evidence(
            session,
            user.career_brain.id,
            SourceType.RESUME_DRAFT_ITEM,
            item_id,
            _canonical_json(normalized),
            origin=EvidenceOrigin.RESUME_IMPORT,
            confirmation_status=ConfirmationStatus.UNCONFIRMED,
            created_by=CreatedBy.AI,
        )
        item = ResumeDraftItem(
            id=item_id,
            resume_import_id=resume_import.id,
            parent_item_id=parent_id,
            item_type=item_type.value,
            data=normalized,
            position=position,
            status=ResumeDraftItemStatus.ACTIVE.value,
            evidence_id=evidence.id,
        )
        session.add(item)
        await session.flush()
        return item

    for education in draft.educations:
        await add_item(ResumeDraftItemType.EDUCATION, education.model_dump(mode="json"))
    for experience in draft.experiences:
        parent = await add_item(
            ResumeDraftItemType.EXPERIENCE,
            experience.model_dump(mode="json", exclude={"details"}),
        )
        for detail in experience.details:
            await add_item(
                ResumeDraftItemType.EXPERIENCE_DETAIL,
                detail.model_dump(mode="json"),
                parent.id,
            )
    for project in draft.projects:
        parent = await add_item(
            ResumeDraftItemType.PROJECT,
            project.model_dump(mode="json", exclude={"details"}),
        )
        for detail in project.details:
            await add_item(
                ResumeDraftItemType.PROJECT_DETAIL,
                detail.model_dump(mode="json"),
                parent.id,
            )
    for skill in draft.skills:
        await add_item(ResumeDraftItemType.SKILL, skill.model_dump(mode="json"))

    resume_import.status = ResumeImportStatus.READY_FOR_REVIEW.value
    await session.flush()
    return resume_import


async def get_owned_import(
    session: AsyncSession, import_id: UUID, user_id: UUID, *, lock: bool = False
) -> ResumeImport:
    query = (
        select(ResumeImport)
        .options(
            selectinload(ResumeImport.items).selectinload(ResumeDraftItem.evidence),
            selectinload(ResumeImport.version).selectinload(ResumeVersion.resume),
            selectinload(ResumeImport.version).selectinload(ResumeVersion.asset),
        )
        .where(ResumeImport.id == import_id, ResumeImport.user_id == user_id)
    )
    if lock:
        query = query.with_for_update()
    result = await session.execute(query)
    resume_import = result.scalar_one_or_none()
    if resume_import is None:
        raise ResumeStateError("Resume import not found")
    return resume_import


async def update_draft_item(
    session: AsyncSession,
    resume_import: ResumeImport,
    item_id: UUID,
    changes: dict[str, object],
) -> ResumeDraftItem:
    if resume_import.status != ResumeImportStatus.READY_FOR_REVIEW.value:
        raise ResumeStateError("Only imports awaiting review can be edited")
    item = next((candidate for candidate in resume_import.items if candidate.id == item_id), None)
    if item is None:
        raise ResumeStateError("Draft item not found")
    if item.status != ResumeDraftItemStatus.ACTIVE.value:
        raise ResumeStateError("Removed or confirmed items cannot be edited")
    if "source_text" in changes:
        changes = {key: value for key, value in changes.items() if key != "source_text"}
    merged = {**item.data, **changes}
    normalized = validate_draft_data(item.item_type, merged)
    item.data = normalized
    await append_evidence_revision(
        session,
        item.evidence,
        _canonical_json(normalized),
        origin=EvidenceOrigin.RESUME_IMPORT,
        confirmation_status=ConfirmationStatus.UNCONFIRMED,
        created_by=CreatedBy.USER,
    )
    await session.flush()
    return item


async def remove_draft_item(
    session: AsyncSession, resume_import: ResumeImport, item_id: UUID
) -> ResumeDraftItem:
    if resume_import.status != ResumeImportStatus.READY_FOR_REVIEW.value:
        raise ResumeStateError("Only imports awaiting review can be edited")
    item = next((candidate for candidate in resume_import.items if candidate.id == item_id), None)
    if item is None:
        raise ResumeStateError("Draft item not found")
    affected = {item.id}
    changed = True
    while changed:
        changed = False
        for candidate in resume_import.items:
            if candidate.parent_item_id in affected and candidate.id not in affected:
                affected.add(candidate.id)
                changed = True
    for candidate in resume_import.items:
        if candidate.id in affected:
            candidate.status = ResumeDraftItemStatus.REMOVED.value
    await session.flush()
    return item


def _without_source(data: dict[str, object]) -> dict[str, object]:
    return {key: value for key, value in data.items() if key != "source_text"}


async def _confirm_evidence(
    session: AsyncSession,
    item: ResumeDraftItem,
    source_type: SourceType,
    source_id: UUID,
) -> None:
    existing = await session.scalar(
        select(CareerEvidence).where(
            CareerEvidence.source_type == source_type.value,
            CareerEvidence.source_id == source_id,
        )
    )
    if existing is None:
        item.evidence.source_type = source_type.value
        item.evidence.source_id = source_id
        evidence = item.evidence
    else:
        evidence = item.evidence
    await append_evidence_revision(
        session,
        evidence,
        _canonical_json(item.data),
        origin=EvidenceOrigin.RESUME_IMPORT,
        confirmation_status=ConfirmationStatus.CONFIRMED,
        created_by=CreatedBy.USER,
    )
    item.materialized_source_type = source_type.value
    item.materialized_source_id = source_id
    item.status = ResumeDraftItemStatus.CONFIRMED.value


async def confirm_resume_import(session: AsyncSession, resume_import: ResumeImport) -> None:
    if resume_import.status == ResumeImportStatus.CONFIRMED.value:
        return
    if resume_import.status != ResumeImportStatus.READY_FOR_REVIEW.value:
        raise ResumeStateError("Resume import is not ready for confirmation")

    active = [
        item
        for item in sorted(resume_import.items, key=lambda candidate: candidate.position)
        if item.status == ResumeDraftItemStatus.ACTIVE.value
    ]
    parent_sources: dict[UUID, UUID] = {}

    for item in active:
        data = _without_source(item.data)
        source_type: SourceType
        source_id: UUID
        if item.item_type == ResumeDraftItemType.EDUCATION.value:
            education = await session.scalar(
                select(Education).where(
                    Education.career_brain_id == resume_import.career_brain_id,
                    func.lower(Education.institution) == str(data["institution"]).casefold(),
                    Education.degree == data.get("degree"),
                    Education.start_date == data.get("start_date"),
                    Education.end_date == data.get("end_date"),
                )
            )
            if education is None:
                education = Education(career_brain_id=resume_import.career_brain_id, **data)
                session.add(education)
                await session.flush()
            source_type, source_id = SourceType.EDUCATION, education.id
        elif item.item_type == ResumeDraftItemType.EXPERIENCE.value:
            experience = await session.scalar(
                select(Experience).where(
                    Experience.career_brain_id == resume_import.career_brain_id,
                    func.lower(Experience.company) == str(data["company"]).casefold(),
                    func.lower(Experience.title) == str(data["title"]).casefold(),
                    Experience.start_date == data.get("start_date"),
                    Experience.end_date == data.get("end_date"),
                )
            )
            if experience is None:
                experience = Experience(career_brain_id=resume_import.career_brain_id, **data)
                session.add(experience)
                await session.flush()
            source_type, source_id = SourceType.EXPERIENCE, experience.id
            parent_sources[item.id] = experience.id
        elif item.item_type == ResumeDraftItemType.PROJECT.value:
            project = await session.scalar(
                select(Project).where(
                    Project.career_brain_id == resume_import.career_brain_id,
                    func.lower(Project.name) == str(data["name"]).casefold(),
                    Project.url == data.get("url"),
                )
            )
            if project is None:
                project = Project(career_brain_id=resume_import.career_brain_id, **data)
                session.add(project)
                await session.flush()
            source_type, source_id = SourceType.PROJECT, project.id
            parent_sources[item.id] = project.id
        elif item.item_type == ResumeDraftItemType.SKILL.value:
            skill = await session.scalar(
                select(Skill).where(
                    Skill.career_brain_id == resume_import.career_brain_id,
                    func.lower(Skill.name) == str(data["name"]).casefold(),
                )
            )
            if skill is None:
                skill = Skill(career_brain_id=resume_import.career_brain_id, **data)
                session.add(skill)
                await session.flush()
            source_type, source_id = SourceType.SKILL, skill.id
        else:
            continue
        await _confirm_evidence(session, item, source_type, source_id)

    for item in active:
        data = _without_source(item.data)
        if item.item_type == ResumeDraftItemType.EXPERIENCE_DETAIL.value:
            parent_id = parent_sources.get(item.parent_item_id) if item.parent_item_id else None
            if parent_id is None:
                continue
            experience_detail = await session.scalar(
                select(ExperienceDetail).where(
                    ExperienceDetail.experience_id == parent_id,
                    func.lower(ExperienceDetail.content) == str(data["content"]).casefold(),
                )
            )
            if experience_detail is None:
                experience_detail = ExperienceDetail(experience_id=parent_id, **data)
                session.add(experience_detail)
                await session.flush()
            await _confirm_evidence(
                session, item, SourceType.EXPERIENCE_DETAIL, experience_detail.id
            )
        elif item.item_type == ResumeDraftItemType.PROJECT_DETAIL.value:
            parent_id = parent_sources.get(item.parent_item_id) if item.parent_item_id else None
            if parent_id is None:
                continue
            project_detail = await session.scalar(
                select(ProjectDetail).where(
                    ProjectDetail.project_id == parent_id,
                    func.lower(ProjectDetail.content) == str(data["content"]).casefold(),
                )
            )
            if project_detail is None:
                project_detail = ProjectDetail(project_id=parent_id, **data)
                session.add(project_detail)
                await session.flush()
            await _confirm_evidence(session, item, SourceType.PROJECT_DETAIL, project_detail.id)

    resume_import.status = ResumeImportStatus.CONFIRMED.value
    resume_import.confirmed_at = datetime.now(UTC)
    await session.flush()
