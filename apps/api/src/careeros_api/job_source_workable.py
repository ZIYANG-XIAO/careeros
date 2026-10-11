"""Workable public job widget adapter (North America).

Workable publishes each employer's open jobs, with descriptions, at
``https://apply.workable.com/api/v1/widget/accounts/{account}?details=true``
for embedding on career sites. Its ``robots.txt`` disallows nothing and
signals ``search=yes``. See ``docs/JOB_SOURCE_DECISION.md``.

Each job lists one or more locations with ISO country codes; those decide
placement, and the shared conservative text rule runs only when none carries
a code.
"""

from datetime import UTC, datetime
from typing import Any

import httpx

from careeros_api.job_source_boards import (
    BoardAdapter,
    BoardFetchError,
    BoardMapping,
    NormalizedJobCandidate,
    SourceBoard,
    build_candidate,
    description_text,
    employment_from_title,
    fetch_json,
    is_standing_interest_posting,
    north_american_country,
    placement_from_countries,
    posted_moment,
    resolve_north_america,
    text_value,
    workplace_from_text,
)
from careeros_api.models import JobCountry, JobEmploymentType, JobWorkplaceType

WORKABLE_SOURCE_KEY = "workable"
API_BASE = "https://apply.workable.com/api/v1/widget/accounts"

_EMPLOYMENT = {
    "full-time": JobEmploymentType.FULL_TIME,
    "part-time": JobEmploymentType.PART_TIME,
    "contract": JobEmploymentType.CONTRACT,
    "temporary": JobEmploymentType.CONTRACT,
    "internship": JobEmploymentType.INTERNSHIP,
}


def _locations(raw: dict[str, Any]) -> list[dict[str, Any]]:
    entries = [item for item in raw.get("locations") or [] if isinstance(item, dict)]
    if entries:
        return entries
    return [{"country": raw.get("country"), "city": raw.get("city"), "region": raw.get("state")}]


def _label(entry: dict[str, Any]) -> str:
    parts = (text_value(entry.get(key)) for key in ("city", "region", "country"))
    return ", ".join(part for part in parts if part)


def _country(entry: dict[str, Any]) -> JobCountry | None:
    code = text_value(entry.get("countryCode"))
    if code:
        return north_american_country(code)
    name = text_value(entry.get("country"))
    if name:
        return north_american_country(name)
    placement = resolve_north_america([_label(entry)])
    return placement[1] if placement else None


def _posted(value: Any, observed_at: datetime) -> datetime | None:
    """``published_on`` is a bare date; read it as UTC midnight."""
    if isinstance(value, str) and len(value.strip()) == 10:
        value = f"{value.strip()}T00:00:00+00:00"
    return posted_moment(value, observed_at)


def map_account(
    payload: Any, board: SourceBoard, observed_at: datetime | None = None
) -> BoardMapping:
    if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
        raise BoardFetchError("Unexpected Workable payload shape")
    moment = observed_at or datetime.now(UTC)
    candidates: list[NormalizedJobCandidate] = []
    fetched = outside = invalid = not_opening = 0
    for raw in payload["jobs"]:
        shortcode = raw.get("shortcode") if isinstance(raw, dict) else None
        if not isinstance(shortcode, str) or not shortcode:
            invalid += 1
            continue
        fetched += 1
        locations = _locations(raw)
        countries = [country for entry in locations if (country := _country(entry)) is not None]
        placement = placement_from_countries(countries)
        if placement is None:
            outside += 1
            continue
        title = text_value(raw.get("title"))
        if is_standing_interest_posting(title):
            not_opening += 1
            continue
        location = " · ".join(label for entry in locations if (label := _label(entry)))
        workplace = (
            JobWorkplaceType.REMOTE
            if raw.get("telecommuting") is True
            else workplace_from_text(location)
        )
        candidate = build_candidate(
            external_id=f"{board.external_id_prefix}{shortcode}",
            board=board,
            title=title,
            location=location,
            description=description_text(text_value(raw.get("description"))),
            posting_url=text_value(raw.get("url")),
            application_url=text_value(raw.get("application_url")),
            placement=placement,
            workplace=workplace,
            employment=_EMPLOYMENT.get(text_value(raw.get("employment_type")).lower())
            or employment_from_title(title),
            observed_at=moment,
            posted_at=_posted(raw.get("published_on"), moment),
        )
        if candidate is None:
            invalid += 1
        else:
            candidates.append(candidate)
    return BoardMapping(tuple(candidates), fetched, outside, invalid, not_opening)


async def fetch_account(client: httpx.AsyncClient, board: SourceBoard) -> Any:
    return await fetch_json(client, board, f"{API_BASE}/{board.token}", {"details": "true"})


class WorkableBoardAdapter(BoardAdapter):
    def __init__(self, mapping: BoardMapping) -> None:
        super().__init__(WORKABLE_SOURCE_KEY, mapping)
