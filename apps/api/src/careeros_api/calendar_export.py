"""iCalendar (RFC 5545) export of scheduled follow-ups and interviews."""

from collections.abc import Iterable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Response
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.auth import get_current_user
from careeros_api.db import get_db_session
from careeros_api.models import Application, ApplicationActivity, User

router = APIRouter(prefix="/calendar", tags=["calendar"])

# Past items stay visible briefly so an overdue follow-up is not silently lost.
PAST_WINDOW = timedelta(days=30)
DURATIONS = {"INTERVIEW": timedelta(hours=1), "FOLLOW_UP": timedelta(minutes=30)}
KIND_LABELS = {"INTERVIEW": "Interview", "FOLLOW_UP": "Follow-up"}


@dataclass(frozen=True)
class CalendarEvent:
    uid: UUID
    kind: str
    title: str
    company: str
    role: str
    body: str | None
    starts_at: datetime


def _escape(text: str) -> str:
    return (
        text.replace("\\", "\\\\")
        .replace(";", "\;")
        .replace(",", "\\,")
        .replace("\r\n", "\\n")
        .replace("\n", "\\n")
    )


def _fold(line: str) -> str:
    """Fold to 75-octet lines as RFC 5545 requires, never splitting a character."""
    encoded = line.encode()
    if len(encoded) <= 75:
        return line
    parts: list[str] = []
    current = b""
    limit = 75
    for char in line:
        piece = char.encode()
        if len(current) + len(piece) > limit:
            parts.append(current.decode())
            current = b""
            limit = 74  # continuation lines start with a space
        current += piece
    parts.append(current.decode())
    return "\r\n ".join(parts)


def _stamp(value: datetime) -> str:
    return value.astimezone(UTC).strftime("%Y%m%dT%H%M%SZ")


def build_ics(events: Iterable[CalendarEvent], now: datetime) -> str:
    lines = [
        "BEGIN:VCALENDAR",
        "VERSION:2.0",
        "PRODID:-//CareerOS//Application Calendar//EN",
        "CALSCALE:GREGORIAN",
        "METHOD:PUBLISH",
        "X-WR-CALNAME:CareerOS",
    ]
    for event in events:
        summary = f"{KIND_LABELS.get(event.kind, event.kind)}: {event.title}"
        description = f"{event.company} · {event.role}"
        if event.body:
            description = f"{description}\n\n{event.body}"
        lines += [
            "BEGIN:VEVENT",
            f"UID:{event.uid}@careeros",
            f"DTSTAMP:{_stamp(now)}",
            f"DTSTART:{_stamp(event.starts_at)}",
            f"DTEND:{_stamp(event.starts_at + DURATIONS.get(event.kind, timedelta(minutes=30)))}",
            f"SUMMARY:{_escape(summary)}",
            f"DESCRIPTION:{_escape(description)}",
            "BEGIN:VALARM",
            "ACTION:DISPLAY",
            f"DESCRIPTION:{_escape(summary)}",
            "TRIGGER:-PT1H" if event.kind == "INTERVIEW" else "TRIGGER:PT0M",
            "END:VALARM",
            "END:VEVENT",
        ]
    lines.append("END:VCALENDAR")
    return "\r\n".join(_fold(line) for line in lines) + "\r\n"


@router.get("/activities.ics")
async def export_activity_calendar(
    user: Annotated[User, Depends(get_current_user)],
    session: Annotated[AsyncSession, Depends(get_db_session)],
) -> Response:
    """Open follow-ups and interviews as a calendar file to import anywhere."""
    now = datetime.now(UTC)
    rows = await session.execute(
        select(ApplicationActivity, Application)
        .join(Application, Application.id == ApplicationActivity.application_id)
        .where(
            Application.user_id == user.id,
            ApplicationActivity.activity_type.in_(list(DURATIONS)),
            ApplicationActivity.completed_at.is_(None),
            ApplicationActivity.scheduled_at >= now - PAST_WINDOW,
        )
        .order_by(ApplicationActivity.scheduled_at)
    )
    events = [
        CalendarEvent(
            uid=activity.id,
            kind=activity.activity_type,
            title=activity.title,
            company=application.company_snapshot,
            role=application.role_snapshot,
            body=activity.body,
            starts_at=activity.scheduled_at,
        )
        for activity, application in rows.all()
        if activity.scheduled_at is not None
    ]
    return Response(
        content=build_ics(events, now),
        media_type="text/calendar; charset=utf-8",
        headers={
            "Content-Disposition": 'attachment; filename="careeros-calendar.ics"',
            "Cache-Control": "no-store",
        },
    )
