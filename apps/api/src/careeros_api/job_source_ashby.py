"""Ashby public Job Posting API adapter (North America).

Ashby publishes each employer's listed postings at
``https://api.ashbyhq.com/posting-api/job-board/{board}`` for career sites. See
``docs/JOB_SOURCE_DECISION.md``.

Ashby gives structured postal addresses for the primary and secondary
locations; their countries decide placement, and the shared conservative text
rule runs only when no address carries a country. Unlisted postings are
treated as absent.
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
    resolve_north_america,
    text_value,
)
from careeros_api.models import JobCountry, JobEmploymentType, JobWorkplaceType

ASHBY_SOURCE_KEY = "ashby"
API_BASE = "https://api.ashbyhq.com/posting-api/job-board"

_WORKPLACE = {
    "Remote": JobWorkplaceType.REMOTE,
    "Hybrid": JobWorkplaceType.HYBRID,
    "OnSite": JobWorkplaceType.ONSITE,
}
_EMPLOYMENT = {
    "FullTime": JobEmploymentType.FULL_TIME,
    "PartTime": JobEmploymentType.PART_TIME,
    "Intern": JobEmploymentType.INTERNSHIP,
    "Contract": JobEmploymentType.CONTRACT,
    "Temporary": JobEmploymentType.CONTRACT,
}


def _address_country(entry: Any) -> str:
    if not isinstance(entry, dict):
        return ""
    postal = (entry.get("address") or {}).get("postalAddress") or {}
    return text_value(postal.get("addressCountry")) if isinstance(postal, dict) else ""


def _location_country(entry: Any, location: str) -> JobCountry | None:
    """One location's North American country: its address when present,
    otherwise the conservative text rule on its label."""
    named = _address_country(entry)
    if named:
        return north_american_country(named)
    placement = resolve_north_america([location])
    return placement[1] if placement else None


def _locations(raw: dict[str, Any]) -> list[tuple[Any, str]]:
    entries: list[tuple[Any, str]] = [(raw, text_value(raw.get("location")))]
    for item in raw.get("secondaryLocations") or []:
        if isinstance(item, dict):
            entries.append((item, text_value(item.get("location"))))
    return entries


def map_job_board(
    payload: Any, board: SourceBoard, observed_at: datetime | None = None
) -> BoardMapping:
    if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
        raise BoardFetchError("Unexpected Ashby payload shape")
    moment = observed_at or datetime.now(UTC)
    candidates: list[NormalizedJobCandidate] = []
    fetched = 0
    not_opening = 0
    outside = invalid = 0
    for raw in payload["jobs"]:
        job_id = raw.get("id") if isinstance(raw, dict) else None
        if not isinstance(job_id, str) or not job_id:
            invalid += 1
            continue
        if raw.get("isListed") is False:
            continue
        external_id = f"{board.external_id_prefix}{job_id}"
        fetched += 1
        locations = _locations(raw)
        countries: list[JobCountry] = []
        for entry, label in locations:
            country = _location_country(entry, label)
            # resolve_north_america may yield UNKNOWN for "US and Canada".
            if country is not None:
                countries.append(country)
        placement = placement_from_countries(countries)
        if placement is None:
            outside += 1
            continue
        location = " · ".join(label for _, label in locations if label)
        title = text_value(raw.get("title"))
        if is_standing_interest_posting(title):
            not_opening += 1
            continue
        workplace = _WORKPLACE.get(text_value(raw.get("workplaceType")))
        if workplace is None:
            workplace = (
                JobWorkplaceType.REMOTE if raw.get("isRemote") is True else JobWorkplaceType.UNKNOWN
            )
        candidate = build_candidate(
            external_id=external_id,
            board=board,
            title=title,
            location=location,
            description=description_text(text_value(raw.get("descriptionHtml"))),
            posting_url=text_value(raw.get("jobUrl")),
            application_url=text_value(raw.get("applyUrl")),
            placement=placement,
            workplace=workplace,
            employment=_EMPLOYMENT.get(text_value(raw.get("employmentType")))
            or employment_from_title(title),
            observed_at=moment,
        )
        if candidate is None:
            invalid += 1
        else:
            candidates.append(candidate)
    return BoardMapping(tuple(candidates), fetched, outside, invalid, not_opening)


async def fetch_job_board(client: httpx.AsyncClient, board: SourceBoard) -> Any:
    return await fetch_json(client, board, f"{API_BASE}/{board.token}")


class AshbyBoardAdapter(BoardAdapter):
    def __init__(self, mapping: BoardMapping) -> None:
        super().__init__(ASHBY_SOURCE_KEY, mapping)
