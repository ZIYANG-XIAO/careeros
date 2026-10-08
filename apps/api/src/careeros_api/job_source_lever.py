"""Lever public Postings API adapter (North America).

Lever publishes each employer's open postings at
``https://api.lever.co/v0/postings/{site}?mode=json`` for career sites. See
``docs/JOB_SOURCE_DECISION.md``.

Lever gives an explicit ISO ``country`` per posting, which is used first; only
when it is absent does the shared conservative text rule run on the locations.
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
)
from careeros_api.models import JobEmploymentType, JobWorkplaceType

LEVER_SOURCE_KEY = "lever"
API_BASE = "https://api.lever.co/v0/postings"

_WORKPLACE = {
    "remote": JobWorkplaceType.REMOTE,
    "hybrid": JobWorkplaceType.HYBRID,
    "on-site": JobWorkplaceType.ONSITE,
    "onsite": JobWorkplaceType.ONSITE,
}
_COMMITMENT = {
    "full-time": JobEmploymentType.FULL_TIME,
    "full time": JobEmploymentType.FULL_TIME,
    "part-time": JobEmploymentType.PART_TIME,
    "part time": JobEmploymentType.PART_TIME,
    "intern": JobEmploymentType.INTERNSHIP,
    "internship": JobEmploymentType.INTERNSHIP,
    "contract": JobEmploymentType.CONTRACT,
    "contractor": JobEmploymentType.CONTRACT,
    "temporary": JobEmploymentType.CONTRACT,
}


def _description_html(raw: dict[str, Any]) -> str:
    """Lever splits a posting into an intro, headed lists, and a closing note."""
    parts = [text_value(raw.get("description"))]
    for item in raw.get("lists") or []:
        if isinstance(item, dict):
            parts.append(f"<h3>{text_value(item.get('text'))}</h3>")
            parts.append(f"<ul>{text_value(item.get('content'))}</ul>")
    parts.append(text_value(raw.get("additional")))
    return "".join(parts)


def map_postings(
    payload: Any, board: SourceBoard, observed_at: datetime | None = None
) -> BoardMapping:
    if not isinstance(payload, list):
        raise BoardFetchError("Unexpected Lever payload shape")
    moment = observed_at or datetime.now(UTC)
    candidates: list[NormalizedJobCandidate] = []
    fetched = 0
    not_opening = 0
    outside = invalid = 0
    for raw in payload:
        posting_id = raw.get("id") if isinstance(raw, dict) else None
        if not isinstance(posting_id, str) or not posting_id:
            invalid += 1
            continue
        external_id = f"{board.external_id_prefix}{posting_id}"
        fetched += 1
        categories = raw.get("categories") if isinstance(raw.get("categories"), dict) else {}
        location = text_value(categories.get("location"))
        all_locations = [text_value(item) for item in categories.get("allLocations") or [location]]
        country_code = raw.get("country")
        if text_value(country_code):
            country = north_american_country(country_code)
            placement = placement_from_countries([country]) if country else None
        else:
            placement = resolve_north_america(all_locations)
        if placement is None:
            outside += 1
            continue
        title = text_value(raw.get("text"))
        if is_standing_interest_posting(title):
            not_opening += 1
            continue
        commitment = text_value(categories.get("commitment")).lower()
        candidate = build_candidate(
            external_id=external_id,
            board=board,
            title=title,
            location=" · ".join(item for item in all_locations if item),
            description=description_text(_description_html(raw)),
            posting_url=text_value(raw.get("hostedUrl")),
            application_url=text_value(raw.get("applyUrl")),
            placement=placement,
            workplace=_WORKPLACE.get(
                text_value(raw.get("workplaceType")).lower(), JobWorkplaceType.UNKNOWN
            ),
            employment=_COMMITMENT.get(commitment) or employment_from_title(title),
            observed_at=moment,
            posted_at=posted_moment(raw.get("createdAt"), moment),
        )
        if candidate is None:
            invalid += 1
        else:
            candidates.append(candidate)
    return BoardMapping(tuple(candidates), fetched, outside, invalid, not_opening)


async def fetch_postings(client: httpx.AsyncClient, board: SourceBoard) -> Any:
    return await fetch_json(client, board, f"{API_BASE}/{board.token}", {"mode": "json"})


class LeverBoardAdapter(BoardAdapter):
    def __init__(self, mapping: BoardMapping) -> None:
        super().__init__(LEVER_SOURCE_KEY, mapping)
