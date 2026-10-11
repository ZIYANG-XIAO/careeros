"""Workday career-site adapter (North America), via sitemap + schema.org JSON-LD.

Each Workday career site (``https://{tenant}.wd{N}.myworkdayjobs.com/{site}``,
or ``https://wd{N}.myworkdaysite.com/recruiting/{tenant}/{site}``)
advertises a ``siteMap.xml`` in its ``robots.txt`` and embeds a schema.org
``JobPosting`` in every job page for search engines. This adapter reads only
those two things, and only where ``robots.txt`` allows it. It does not use
Workday's internal JSON endpoints. See ``docs/JOB_SOURCE_DECISION.md``.

Workday sitemaps list at most about 100 postings, so a posting missing from a
full-size sitemap may simply have been pushed off it. Absence closes a posting
only when the sitemap is smaller than that cap; otherwise previously
catalogued postings are re-checked one page at a time and closed only when
their page no longer carries a ``JobPosting``.

Already-catalogued postings are not re-fetched, and postings whose URL names a
place outside North America are skipped without fetching their page.
"""

import asyncio
import re
from collections.abc import Mapping
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any
from urllib.parse import urlsplit

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
    fetch_page,
    is_generic_location,
    is_standing_interest_posting,
    json_ld_expired,
    json_ld_job_posting,
    load_robots,
    north_american_country,
    placement_from_countries,
    posted_moment,
    read_listed_pages,
    resolve_north_america,
    sitemap_urls,
    text_value,
    workplace_from_text,
)
from careeros_api.models import JobCountry, JobEmploymentType, JobWorkplaceType

WORKDAY_SOURCE_KEY = "workday"
SITEMAP_CAP = 100
PAUSE_BETWEEN_PAGES_SECONDS = 1.0
MAX_NEW_PAGES_PER_RUN = 1500
MAX_RECHECKS_PER_RUN = 25

# ``{tenant}.wdN.myworkdayjobs.com/{site}`` or ``wdN.myworkdaysite.com/recruiting/{tenant}/{site}``.
_SITE_URL = re.compile(
    r"^https://(?:[a-z0-9-]+\.wd\d+\.myworkdayjobs\.com/[A-Za-z0-9_-]+"
    r"|wd\d+\.myworkdaysite\.com/recruiting/[a-z0-9-]+/[A-Za-z0-9_-]+)$"
)
_EMPLOYMENT = {
    "FULL_TIME": JobEmploymentType.FULL_TIME,
    "PART_TIME": JobEmploymentType.PART_TIME,
    "CONTRACTOR": JobEmploymentType.CONTRACT,
    "TEMPORARY": JobEmploymentType.CONTRACT,
    "INTERN": JobEmploymentType.INTERNSHIP,
}


@dataclass(frozen=True)
class WorkdayFetch:
    """What one sync read from a site, before mapping."""

    listed: Mapping[str, str]  # external id -> posting URL, from the sitemap
    complete: bool
    pages: Mapping[str, tuple[str, dict[str, Any]]] = field(default_factory=dict)
    retained: frozenset[str] = frozenset()
    skipped_outside_market: int = 0


def _site(board: SourceBoard) -> str:
    if not board.site_url or not _SITE_URL.match(board.site_url):
        raise BoardFetchError(f"{board.token}: missing or invalid Workday site_url")
    return board.site_url


def _external_id(board: SourceBoard, url: str) -> str | None:
    """``{token}:{requisition}`` from a job URL ending ``.../Title_JR123``."""
    last = urlsplit(url).path.rstrip("/").rsplit("/", 1)[-1]
    requisition = last.rsplit("_", 1)[-1] if "_" in last else ""
    return f"{board.external_id_prefix}{requisition}" if requisition else None


def _url_place(url: str) -> str:
    """The location segment Workday puts in job URLs (``.../job/US-CA-Santa-Clara/...``)."""
    parts = urlsplit(url).path.split("/")
    if "job" in parts and parts.index("job") + 1 < len(parts) - 1:
        return parts[parts.index("job") + 1].replace("-", ", ")
    return ""


def worth_fetching(url: str) -> bool:
    """Fetch a page only when its URL places it in North America, or says too
    little to tell (``Remote``, ``Multiple Locations``)."""
    place = _url_place(url)
    if not place:
        return True
    if resolve_north_america([place]) is not None:
        return True
    return is_generic_location(place) or "multiple" in place.lower()


def parse_sitemap(xml: str, site: str) -> list[str]:
    prefix = f"{site}/job/"
    return [url for url in sitemap_urls(xml, site) if url.startswith(prefix)]


async def fetch_site(
    client: httpx.AsyncClient,
    board: SourceBoard,
    known: Mapping[str, str],
    *,
    pause: float = PAUSE_BETWEEN_PAGES_SECONDS,
    max_new_pages: int = MAX_NEW_PAGES_PER_RUN,
    max_rechecks: int = MAX_RECHECKS_PER_RUN,
) -> WorkdayFetch:
    """Read one site. ``known`` maps already-open catalog ids to their URLs."""
    site = _site(board)
    origin = f"{urlsplit(site).scheme}://{urlsplit(site).netloc}"
    sitemap_url = f"{site}/siteMap.xml"

    robots = await load_robots(client, board, origin)
    if not robots.allows(sitemap_url) or not robots.allows(f"{site}/job/"):
        raise BoardFetchError(f"{board.token}: robots.txt disallows the sitemap or job pages")

    await asyncio.sleep(pause)
    response = await fetch_page(client, board, sitemap_url)
    if response.status_code != 200:
        raise BoardFetchError(f"{board.token}: sitemap HTTP {response.status_code}")
    listed: dict[str, str] = {}
    for url in parse_sitemap(response.text, site):
        external_id = _external_id(board, url)
        if external_id:
            listed.setdefault(external_id, url)
    complete = len(listed) < SITEMAP_CAP

    read = await read_listed_pages(
        client,
        board,
        robots,
        listed,
        known,
        complete=complete,
        extract=json_ld_job_posting,
        worth_fetching=worth_fetching,
        pause=pause,
        max_new_pages=max_new_pages,
        max_rechecks=max_rechecks,
    )
    return WorkdayFetch(listed, complete, read.pages, read.retained, read.skipped_outside_market)


_DATE_ONLY = re.compile(r"^\d{4}-\d{2}-\d{2}$")


def _posted(value: Any, observed_at: datetime) -> datetime | None:
    """``datePosted`` is usually a bare date; read it as UTC midnight."""
    if isinstance(value, str) and _DATE_ONLY.match(value.strip()):
        value = f"{value.strip()}T00:00:00+00:00"
    return posted_moment(value, observed_at)


def _address(posting: dict[str, Any]) -> tuple[str, str]:
    """(location label, explicit country) from the first ``jobLocation``."""
    places = posting.get("jobLocation")
    place = places[0] if isinstance(places, list) and places else places
    address = place.get("address") if isinstance(place, dict) else None
    if not isinstance(address, dict):
        return "", ""
    label = ", ".join(
        part
        for part in (
            text_value(address.get("addressLocality")),
            text_value(address.get("addressRegion")),
            text_value(address.get("addressCountry")),
        )
        if part
    )
    return label, text_value(address.get("addressCountry"))


def map_site(payload: Any, board: SourceBoard, observed_at: datetime | None = None) -> BoardMapping:
    if not isinstance(payload, WorkdayFetch):
        raise BoardFetchError("Unexpected Workday payload")
    moment = observed_at or datetime.now(UTC)
    candidates: list[NormalizedJobCandidate] = []
    outside = payload.skipped_outside_market
    invalid = not_opening = 0
    for external_id, (url, posting) in payload.pages.items():
        title = text_value(posting.get("title"))
        if json_ld_expired(posting, moment) or is_standing_interest_posting(title):
            not_opening += 1
            continue
        location, country_name = _address(posting)
        countries: list[JobCountry] = []
        if country_name:
            country = north_american_country(country_name)
            if country is not None:
                countries.append(country)
        else:
            placement = resolve_north_america([location or _url_place(url)])
            if placement is not None:
                countries.append(placement[1])
        placement = placement_from_countries(countries)
        if placement is None:
            outside += 1
            continue
        workplace = (
            JobWorkplaceType.REMOTE
            if text_value(posting.get("jobLocationType")).upper() == "TELECOMMUTE"
            else workplace_from_text(location or _url_place(url))
        )
        employment_raw = posting.get("employmentType")
        if isinstance(employment_raw, list):
            employment_raw = employment_raw[0] if employment_raw else ""
        candidate = build_candidate(
            external_id=external_id,
            board=board,
            title=title,
            location=location,
            description=description_text(text_value(posting.get("description"))),
            posting_url=url,
            application_url=url,
            placement=placement,
            workplace=workplace,
            employment=_EMPLOYMENT.get(text_value(employment_raw).upper())
            or employment_from_title(title),
            observed_at=moment,
            posted_at=_posted(posting.get("datePosted"), moment),
        )
        if candidate is None:
            invalid += 1
        else:
            candidates.append(candidate)
    return BoardMapping(
        tuple(candidates),
        len(payload.pages) + len(payload.retained) + payload.skipped_outside_market,
        outside,
        invalid,
        not_opening,
        retained_external_ids=payload.retained,
    )


class WorkdayBoardAdapter(BoardAdapter):
    def __init__(self, mapping: BoardMapping) -> None:
        super().__init__(WORKDAY_SOURCE_KEY, mapping)
