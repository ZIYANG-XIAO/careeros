"""Greenhouse public Job Board API adapter (North America).

Greenhouse publishes each employer's open postings at
``https://boards-api.greenhouse.io/v1/boards/{board_token}/jobs?content=true``
for embedding on career sites. See ``docs/JOB_SOURCE_DECISION.md``.

Greenhouse gives only free-text locations, so placement uses the shared
conservative text rule: the posting's own location first, office names only
when the location says nothing.
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
    is_generic_location,
    is_standing_interest_posting,
    posted_moment,
    resolve_north_america,
    text_value,
    workplace_from_text,
)

GREENHOUSE_SOURCE_KEY = "greenhouse"
API_BASE = "https://boards-api.greenhouse.io/v1/boards"

# Kept for callers and tests written against the Greenhouse-only pilot.
GreenhouseBoard = SourceBoard
GreenhouseFetchError = BoardFetchError

__all__ = [
    "GREENHOUSE_SOURCE_KEY",
    "GreenhouseBoard",
    "GreenhouseBoardAdapter",
    "GreenhouseFetchError",
    "description_text",
    "fetch_board",
    "map_board_jobs",
    "resolve_north_america",
]


def map_board_jobs(
    payload: Any, board: SourceBoard, observed_at: datetime | None = None
) -> BoardMapping:
    """Map one board's ``/jobs?content=true`` payload to normalized candidates.

    ``seen_external_ids`` covers every posting on the board — including ones
    skipped for location — so a posting that merely left the market filter is
    not mistaken for a closed one.
    """
    if not isinstance(payload, dict) or not isinstance(payload.get("jobs"), list):
        raise BoardFetchError("Unexpected Greenhouse payload shape")
    moment = observed_at or datetime.now(UTC)
    candidates: list[NormalizedJobCandidate] = []
    fetched = 0
    not_opening = 0
    outside = invalid = 0
    for raw in payload["jobs"]:
        if not isinstance(raw, dict) or not isinstance(raw.get("id"), int):
            invalid += 1
            continue
        external_id = f"{board.external_id_prefix}{raw['id']}"
        fetched += 1
        location = text_value((raw.get("location") or {}).get("name"))
        offices = [
            text_value(office.get(key))
            for office in raw.get("offices") or []
            if isinstance(office, dict)
            for key in ("name", "location")
        ]
        title = text_value(raw.get("title"))
        if is_standing_interest_posting(title):
            not_opening += 1
            continue
        # The posting's own location decides. Office names are org groupings
        # (e.g. "Canada/US") and are consulted only when the location names no
        # place at all ("Remote", "Hybrid", "N/A"); a location naming somewhere
        # outside North America is never overridden by an office.
        placement = resolve_north_america([location])
        if placement is None and is_generic_location(location):
            placement = resolve_north_america(offices)
        if placement is None:
            outside += 1
            continue
        url = text_value(raw.get("absolute_url"))
        candidate = build_candidate(
            external_id=external_id,
            board=board,
            title=title,
            location=location,
            description=description_text(text_value(raw.get("content"))),
            posting_url=url,
            application_url=url,
            placement=placement,
            workplace=workplace_from_text(location),
            employment=employment_from_title(title),
            observed_at=moment,
            posted_at=posted_moment(raw.get("first_published"), moment),
        )
        if candidate is None:
            invalid += 1
        else:
            candidates.append(candidate)
    return BoardMapping(tuple(candidates), fetched, outside, invalid, not_opening)


async def fetch_board(client: httpx.AsyncClient, board: SourceBoard) -> Any:
    return await fetch_json(client, board, f"{API_BASE}/{board.token}/jobs", {"content": "true"})


class GreenhouseBoardAdapter(BoardAdapter):
    def __init__(self, mapping: BoardMapping) -> None:
        super().__init__(GREENHOUSE_SOURCE_KEY, mapping)
