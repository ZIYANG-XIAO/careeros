"""User-entered people (recruiters, referrers, interviewers) for an application."""

from datetime import datetime
from typing import Annotated, Literal
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Response, status
from pydantic import AnyHttpUrl, BaseModel, ConfigDict, Field
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import Application, ApplicationContact, User

router = APIRouter(prefix="/applications", tags=["application-contacts"])

RelationshipType = Literal["RECRUITER", "HIRING_MANAGER", "INTERVIEWER", "REFERRER", "OTHER"]
MAX_CONTACTS_PER_APPLICATION = 50
# Shape check only; the address is the user's own note and is never contacted.
EMAIL_PATTERN = r"^[^@\s]+@[^@\s]+\.[^@\s]+$"


class ContactFields(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=200)
    relationship_type: RelationshipType = "OTHER"
    email: str | None = Field(default=None, max_length=320, pattern=EMAIL_PATTERN)
    profile_url: AnyHttpUrl | None = None
    notes: str | None = Field(default=None, max_length=5000)


class UpdateContactRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    name: str | None = Field(default=None, min_length=1, max_length=200)
    relationship_type: RelationshipType | None = None
    email: str | None = Field(default=None, max_length=320, pattern=EMAIL_PATTERN)
    profile_url: AnyHttpUrl | None = None
    notes: str | None = Field(default=None, max_length=5000)


class ContactResponse(BaseModel):
    id: UUID
    application_id: UUID
    name: str
    relationship_type: str
    email: str | None
    profile_url: str | None
    notes: str | None
    created_at: datetime
    updated_at: datetime


def _response(contact: ApplicationContact) -> ContactResponse:
    return ContactResponse(
        id=contact.id,
        application_id=contact.application_id,
        name=contact.name,
        relationship_type=contact.relationship_type,
        email=contact.email,
        profile_url=contact.profile_url,
        notes=contact.notes,
        created_at=contact.created_at,
        updated_at=contact.updated_at,
    )


async def _require_application(session: AsyncSession, user: User, application_id: UUID) -> None:
    owned = await session.scalar(
        select(Application.id).where(
            Application.id == application_id, Application.user_id == user.id
        )
    )
    if owned is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Application not found")


async def _owned_contact(
    session: AsyncSession, user: User, application_id: UUID, contact_id: UUID
) -> ApplicationContact:
    contact = await session.scalar(
        select(ApplicationContact)
        .join(Application, Application.id == ApplicationContact.application_id)
        .where(
            ApplicationContact.id == contact_id,
            ApplicationContact.application_id == application_id,
            Application.user_id == user.id,
        )
    )
    if contact is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contact not found")
    return contact


@router.get("/{application_id}/contacts", response_model=list[ContactResponse])
async def list_contacts(
    application_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> list[ContactResponse]:
    await _require_application(session, user, application_id)
    rows = await session.scalars(
        select(ApplicationContact)
        .where(ApplicationContact.application_id == application_id)
        .order_by(ApplicationContact.created_at)
    )
    return [_response(row) for row in rows]


@router.post(
    "/{application_id}/contacts",
    response_model=ContactResponse,
    status_code=status.HTTP_201_CREATED,
)
async def create_contact(
    application_id: UUID,
    body: ContactFields,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ContactResponse:
    await _require_application(session, user, application_id)
    existing = await session.scalars(
        select(ApplicationContact.id).where(ApplicationContact.application_id == application_id)
    )
    if len(existing.all()) >= MAX_CONTACTS_PER_APPLICATION:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={"code": "TOO_MANY_CONTACTS", "message": "Contact limit reached"},
        )
    contact = ApplicationContact(
        application_id=application_id,
        name=body.name,
        relationship_type=body.relationship_type,
        email=str(body.email) if body.email else None,
        profile_url=str(body.profile_url) if body.profile_url else None,
        notes=body.notes or None,
    )
    session.add(contact)
    await session.flush()
    await session.refresh(contact)
    return _response(contact)


@router.patch("/{application_id}/contacts/{contact_id}", response_model=ContactResponse)
async def update_contact(
    application_id: UUID,
    contact_id: UUID,
    body: UpdateContactRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ContactResponse:
    contact = await _owned_contact(session, user, application_id, contact_id)
    changes = body.model_dump(exclude_unset=True)
    if "name" in changes and not changes["name"]:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail={"code": "INVALID_CONTACT", "message": "name cannot be empty"},
        )
    for field, value in changes.items():
        if field in {"email", "profile_url"}:
            value = str(value) if value else None
        elif field == "notes":
            value = value or None
        setattr(contact, field, value)
    await session.flush()
    await session.refresh(contact)
    return _response(contact)


@router.delete("/{application_id}/contacts/{contact_id}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_contact(
    application_id: UUID,
    contact_id: UUID,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Response:
    contact = await _owned_contact(session, user, application_id, contact_id)
    await session.execute(delete(ApplicationContact).where(ApplicationContact.id == contact.id))
    return Response(status_code=status.HTTP_204_NO_CONTENT)
