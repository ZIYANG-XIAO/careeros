"""Authenticated resume ingestion and library endpoints."""

import asyncio
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import selectinload

from careeros_api.auth import get_current_user
from careeros_api.config import Settings, get_settings
from careeros_api.db import get_db_session
from careeros_api.models import Resume, ResumeDraftItem, ResumeImport, ResumeVersion, User
from careeros_api.resume_extraction import ResumeFileError, detect_resume_type, extract_resume_text
from careeros_api.resume_parser import ResumeParser, ResumeParsingError, get_resume_parser
from careeros_api.resume_schemas import ParsedResumeDraft, validate_grounding
from careeros_api.resume_service import (
    ResumeStateError,
    confirm_resume_import,
    create_resume_import,
    get_owned_import,
    remove_draft_item,
    update_draft_item,
)
from careeros_api.resume_storage import LocalResumeAssetStorage

router = APIRouter(tags=["resumes"])


class ResumeDraftItemResponse(BaseModel):
    id: UUID
    parent_item_id: UUID | None
    item_type: str
    data: dict[str, object]
    position: int
    status: str
    materialized_source_type: str | None
    materialized_source_id: UUID | None


class ResumeImportResponse(BaseModel):
    id: UUID
    resume_id: UUID
    resume_name: str
    resume_version_id: UUID
    version_number: int
    status: str
    error_code: str | None
    error_message: str | None
    items: list[ResumeDraftItemResponse]
    created_at: datetime
    confirmed_at: datetime | None


class ResumeVersionResponse(BaseModel):
    id: UUID
    version_number: int
    source: str
    created_by: str
    source_version_id: UUID | None
    original_filename: str
    content_type: str
    size_bytes: int
    sha256: str
    parser_version: str
    extracted_text: str
    structured_content: dict[str, object]
    created_at: datetime


class ResumeSummaryResponse(BaseModel):
    id: UUID
    name: str
    type: str
    is_primary: bool
    created_at: datetime
    updated_at: datetime
    versions: list[ResumeVersionResponse]


class UpdateDraftItemRequest(BaseModel):
    data: dict[str, object]


def resume_parser_dependency() -> ResumeParser:
    try:
        return get_resume_parser()
    except ResumeParsingError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail=str(error),
        ) from error


def _item_response(item: ResumeDraftItem) -> ResumeDraftItemResponse:
    return ResumeDraftItemResponse(
        id=item.id,
        parent_item_id=item.parent_item_id,
        item_type=item.item_type,
        data=item.data,
        position=item.position,
        status=item.status,
        materialized_source_type=item.materialized_source_type,
        materialized_source_id=item.materialized_source_id,
    )


def _import_response(resume_import: ResumeImport) -> ResumeImportResponse:
    version = resume_import.version
    return ResumeImportResponse(
        id=resume_import.id,
        resume_id=version.resume.id,
        resume_name=version.resume.name,
        resume_version_id=version.id,
        version_number=version.version_number,
        status=resume_import.status,
        error_code=resume_import.error_code,
        error_message=resume_import.error_message,
        items=[
            _item_response(item) for item in sorted(resume_import.items, key=lambda x: x.position)
        ],
        created_at=resume_import.created_at,
        confirmed_at=resume_import.confirmed_at,
    )


def _version_response(version: ResumeVersion) -> ResumeVersionResponse:
    return ResumeVersionResponse(
        id=version.id,
        version_number=version.version_number,
        source=version.source,
        created_by=version.created_by,
        source_version_id=version.source_version_id,
        original_filename=version.asset.original_filename,
        content_type=version.asset.content_type,
        size_bytes=version.asset.size_bytes,
        sha256=version.asset.sha256,
        parser_version=version.parser_version,
        extracted_text=version.extracted_text,
        structured_content=version.structured_content,
        created_at=version.created_at,
    )


def _resume_response(resume: Resume) -> ResumeSummaryResponse:
    return ResumeSummaryResponse(
        id=resume.id,
        name=resume.name,
        type=resume.type,
        is_primary=resume.is_primary,
        created_at=resume.created_at,
        updated_at=resume.updated_at,
        versions=[
            _version_response(version)
            for version in sorted(
                resume.versions, key=lambda item: item.version_number, reverse=True
            )
        ],
    )


@router.post(
    "/resume-imports",
    response_model=ResumeImportResponse,
    status_code=status.HTTP_201_CREATED,
)
async def upload_resume(
    file: Annotated[UploadFile, File()],
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
    parser: Annotated[ResumeParser, Depends(resume_parser_dependency)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> ResumeImportResponse:
    data = await file.read(settings.max_resume_size_bytes + 1)
    if not data:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail="Empty file")
    if len(data) > settings.max_resume_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail="Resume exceeds the 5 MB upload limit",
        )
    try:
        content_type, suffix = await asyncio.to_thread(detect_resume_type, data)
        extracted_text = await asyncio.to_thread(extract_resume_text, data, content_type)
        parser_output = await parser.parse_resume_to_career_draft(extracted_text)
        draft = ParsedResumeDraft.model_validate(parser_output)
        validate_grounding(draft, extracted_text)
    except ResumeFileError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": error.code, "message": str(error)},
        ) from error
    except (ResumeParsingError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "PARSING_FAILED", "message": str(error)},
        ) from error

    storage = LocalResumeAssetStorage(settings.resume_storage_dir)
    storage_key = await asyncio.to_thread(storage.save, data, suffix)
    try:
        resume_import = await create_resume_import(
            session,
            user,
            filename=file.filename or "resume" + suffix,
            content_type=content_type,
            storage_key=storage_key,
            data=data,
            extracted_text=extracted_text,
            draft=draft,
        )
        loaded = await get_owned_import(session, resume_import.id, user.id)
        return _import_response(loaded)
    except Exception:
        await asyncio.to_thread(storage.delete, storage_key)
        raise


@router.get("/resume-imports/{import_id}", response_model=ResumeImportResponse)
async def get_resume_import(
    import_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeImportResponse:
    try:
        return _import_response(await get_owned_import(session, import_id, user.id))
    except ResumeStateError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.patch("/resume-imports/{import_id}/items/{item_id}", response_model=ResumeDraftItemResponse)
async def patch_resume_draft_item(
    import_id: UUID,
    item_id: UUID,
    body: UpdateDraftItemRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeDraftItemResponse:
    try:
        resume_import = await get_owned_import(session, import_id, user.id, lock=True)
        return _item_response(await update_draft_item(session, resume_import, item_id, body.data))
    except ResumeStateError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY, detail=str(error)
        ) from error


@router.delete(
    "/resume-imports/{import_id}/items/{item_id}",
    response_model=ResumeDraftItemResponse,
)
async def delete_resume_draft_item(
    import_id: UUID,
    item_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeDraftItemResponse:
    try:
        resume_import = await get_owned_import(session, import_id, user.id, lock=True)
        return _item_response(await remove_draft_item(session, resume_import, item_id))
    except ResumeStateError as error:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(error)) from error


@router.post("/resume-imports/{import_id}/confirm", response_model=ResumeImportResponse)
async def confirm_import(
    import_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeImportResponse:
    try:
        resume_import = await get_owned_import(session, import_id, user.id, lock=True)
        await confirm_resume_import(session, resume_import)
        return _import_response(resume_import)
    except ResumeStateError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error


@router.get("/resumes", response_model=list[ResumeSummaryResponse])
async def list_resumes(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[ResumeSummaryResponse]:
    result = await session.execute(
        select(Resume)
        .options(selectinload(Resume.versions).selectinload(ResumeVersion.asset))
        .where(Resume.user_id == user.id)
        .order_by(Resume.created_at.desc())
    )
    return [_resume_response(resume) for resume in result.scalars().all()]


@router.get("/resumes/{resume_id}", response_model=ResumeSummaryResponse)
async def get_resume(
    resume_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeSummaryResponse:
    resume = await session.scalar(
        select(Resume)
        .options(selectinload(Resume.versions).selectinload(ResumeVersion.asset))
        .where(Resume.id == resume_id, Resume.user_id == user.id)
    )
    if resume is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Resume not found")
    return _resume_response(resume)


@router.get("/resumes/{resume_id}/versions/{version_id}", response_model=ResumeVersionResponse)
async def get_resume_version(
    resume_id: UUID,
    version_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ResumeVersionResponse:
    version = await session.scalar(
        select(ResumeVersion)
        .join(Resume)
        .options(selectinload(ResumeVersion.asset))
        .where(
            ResumeVersion.id == version_id,
            ResumeVersion.resume_id == resume_id,
            Resume.user_id == user.id,
        )
    )
    if version is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND, detail="Resume version not found"
        )
    return _version_response(version)
