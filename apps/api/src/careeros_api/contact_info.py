import re
from datetime import UTC, datetime
from enum import StrEnum
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends
from pydantic import AnyHttpUrl, BaseModel, field_validator
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import User, UserContactInfo

router = APIRouter(tags=["contact-info"])

PHONE_PATTERN = re.compile(r"^[\d\s\-()+]{7,20}$")
EMAIL_PATTERN = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


class NameOrder(StrEnum):
    UNKNOWN = "UNKNOWN"
    GIVEN_FAMILY = "GIVEN_FAMILY"
    FAMILY_GIVEN = "FAMILY_GIVEN"


# ---------------------------------------------------------------------------
# Schemas
# ---------------------------------------------------------------------------


class ContactInfoResponse(BaseModel):
    id: UUID | None
    first_name: str | None
    last_name: str | None
    preferred_name: str | None
    full_name_native: str | None
    full_name_latin: str | None
    name_order: NameOrder
    contact_email: str | None
    phone: str | None
    wechat_id: str | None
    address_line_1: str | None
    address_line_2: str | None
    city: str | None
    district: str | None
    region: str | None
    postal_code: str | None
    country_code: str | None
    linkedin_url: str | None
    github_url: str | None
    portfolio_url: str | None
    confirmed_at: datetime | None
    created_at: datetime | None
    updated_at: datetime | None


class ContactInfoUpsertRequest(BaseModel):
    first_name: str | None = None
    last_name: str | None = None
    preferred_name: str | None = None
    full_name_native: str | None = None
    full_name_latin: str | None = None
    name_order: NameOrder | None = None
    contact_email: str | None = None
    phone: str | None = None
    wechat_id: str | None = None
    address_line_1: str | None = None
    address_line_2: str | None = None
    city: str | None = None
    district: str | None = None
    region: str | None = None
    postal_code: str | None = None
    country_code: str | None = None
    linkedin_url: AnyHttpUrl | None = None
    github_url: AnyHttpUrl | None = None
    portfolio_url: AnyHttpUrl | None = None

    @field_validator(
        "first_name",
        "last_name",
        "preferred_name",
        "wechat_id",
        "city",
        "district",
        "region",
    )
    @classmethod
    def validate_name_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 100:
            raise ValueError("must be at most 100 characters")
        return v

    @field_validator("full_name_native", "full_name_latin")
    @classmethod
    def validate_full_name_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 200:
            raise ValueError("must be at most 200 characters")
        return v

    @field_validator("contact_email")
    @classmethod
    def validate_contact_email(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) > 255 or not EMAIL_PATTERN.match(v):
            raise ValueError("invalid email format")
        return v

    @field_validator("address_line_1", "address_line_2")
    @classmethod
    def validate_address_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 255:
            raise ValueError("must be at most 255 characters")
        return v

    @field_validator("postal_code")
    @classmethod
    def validate_postal_code_length(cls, v: str | None) -> str | None:
        if v is not None and len(v) > 20:
            raise ValueError("must be at most 20 characters")
        return v

    @field_validator("phone")
    @classmethod
    def validate_phone(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if not PHONE_PATTERN.match(v):
            raise ValueError("invalid phone format")
        return v

    @field_validator("country_code")
    @classmethod
    def validate_country_code(cls, v: str | None) -> str | None:
        if v is None:
            return v
        if len(v) != 2:
            raise ValueError("country_code must be exactly 2 characters")
        return v.upper()

    @field_validator("linkedin_url", "github_url", "portfolio_url", mode="before")
    @classmethod
    def validate_url_length(cls, v: object) -> object:
        if v is not None and isinstance(v, str) and len(v) > 2000:
            raise ValueError("must be at most 2000 characters")
        return v


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------


@router.get("/contact-info", response_model=ContactInfoResponse)
async def get_contact_info(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ContactInfoResponse:
    result = await session.execute(
        select(UserContactInfo).where(UserContactInfo.user_id == user.id)
    )
    contact = result.scalar_one_or_none()
    if contact is None:
        return _empty_response()
    return _to_response(contact)


@router.put("/contact-info", response_model=ContactInfoResponse)
async def upsert_contact_info(
    body: ContactInfoUpsertRequest,
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> ContactInfoResponse:
    contact = await apply_contact_info_updates(session, user.id, body)
    await session.refresh(contact)
    return _to_response(contact)


async def apply_contact_info_updates(
    session: AsyncSession,
    user_id: UUID,
    body: ContactInfoUpsertRequest,
) -> UserContactInfo:
    """Apply only explicitly supplied, user-confirmed contact fields."""
    now = datetime.now(UTC)
    updates = _serialize_updates(body)

    result = await session.execute(
        select(UserContactInfo).where(UserContactInfo.user_id == user_id)
    )
    contact = result.scalar_one_or_none()

    if contact is None:
        try:
            async with session.begin_nested():
                contact = UserContactInfo(user_id=user_id, confirmed_at=now, **updates)
                session.add(contact)
                await session.flush()
        except IntegrityError:
            result = await session.execute(
                select(UserContactInfo).where(UserContactInfo.user_id == user_id)
            )
            contact = result.scalar_one()
            _apply_updates(contact, updates, now)
    else:
        _apply_updates(contact, updates, now)

    await session.flush()
    return contact


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def _empty_response() -> ContactInfoResponse:
    return ContactInfoResponse(
        id=None,
        first_name=None,
        last_name=None,
        preferred_name=None,
        full_name_native=None,
        full_name_latin=None,
        name_order=NameOrder.UNKNOWN,
        contact_email=None,
        phone=None,
        wechat_id=None,
        address_line_1=None,
        address_line_2=None,
        city=None,
        district=None,
        region=None,
        postal_code=None,
        country_code=None,
        linkedin_url=None,
        github_url=None,
        portfolio_url=None,
        confirmed_at=None,
        created_at=None,
        updated_at=None,
    )


def _serialize_updates(body: ContactInfoUpsertRequest) -> dict[str, object]:
    updates = body.model_dump(exclude_unset=True)
    for url_field in ("linkedin_url", "github_url", "portfolio_url"):
        if url_field in updates and updates[url_field] is not None:
            updates[url_field] = str(updates[url_field])
    return updates


def _apply_updates(
    contact: UserContactInfo,
    updates: dict[str, object],
    confirmed_at: datetime,
) -> None:
    for field, value in updates.items():
        setattr(contact, field, value)
    contact.confirmed_at = confirmed_at


def _to_response(contact: UserContactInfo) -> ContactInfoResponse:
    return ContactInfoResponse(
        id=contact.id,
        first_name=contact.first_name,
        last_name=contact.last_name,
        preferred_name=contact.preferred_name,
        full_name_native=contact.full_name_native,
        full_name_latin=contact.full_name_latin,
        name_order=NameOrder(contact.name_order),
        contact_email=contact.contact_email,
        phone=contact.phone,
        wechat_id=contact.wechat_id,
        address_line_1=contact.address_line_1,
        address_line_2=contact.address_line_2,
        city=contact.city,
        district=contact.district,
        region=contact.region,
        postal_code=contact.postal_code,
        country_code=contact.country_code,
        linkedin_url=contact.linkedin_url,
        github_url=contact.github_url,
        portfolio_url=contact.portfolio_url,
        confirmed_at=contact.confirmed_at,
        created_at=contact.created_at,
        updated_at=contact.updated_at,
    )
