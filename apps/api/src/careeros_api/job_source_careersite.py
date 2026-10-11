"""Large employers' own career sites (North America).

Each employer runs its own site, so each has a small reader here; mapping,
robots.txt checks, incremental fetching, and closing rules are shared. Every
reader first checks the site's ``robots.txt`` (RFC 9309) and reads only paths
it allows. See ``docs/JOB_SOURCE_DECISION.md``.

- **Amazon** — ``/en/search.json``, the JSON behind amazon.jobs search. One
  query returns at most 10,000 hits, so countries above that are read one job
  category at a time (each well under the cap).
- **Eightfold sites (Microsoft, NVIDIA, Qualcomm, PayPal, Netflix, Morgan
  Stanley, Citi, HP)** — the ``/api/pcsx`` search
  and details endpoints, or the older ``/api/apply/v2/jobs`` ones, which these
  sites' ``robots.txt`` explicitly allows while disallowing everything else.
- **Meta** — the job sitemap advertised in ``robots.txt`` plus each job page's
  schema.org ``JobPosting``.
- **Apple** — the US job sitemap plus the posting data embedded in each job
  page (Apple publishes no ``JobPosting``; this is the most fragile reader).

Google's career site is not read: its ``robots.txt`` disallows job pages.
"""

import asyncio
import json
import re
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Any

import httpx

from careeros_api.job_source_boards import (
    USER_AGENT,
    BoardAdapter,
    BoardFetchError,
    BoardMapping,
    NormalizedJobCandidate,
    Robots,
    SourceBoard,
    build_candidate,
    description_text,
    employment_from_title,
    fetch_page,
    is_standing_interest_posting,
    json_ld_expired,
    json_ld_job_posting,
    load_robots,
    north_american_country,
    placement_from_countries,
    posted_moment,
    read_listed_pages,
    recheck_missing,
    resolve_north_america,
    sitemap_urls,
    text_value,
    workplace_from_text,
)
from careeros_api.models import JobCountry, JobEmploymentType, JobWorkplaceType

CAREERSITE_SOURCE_KEY = "careersite"
PAUSE_BETWEEN_REQUESTS_SECONDS = 1.0
MAX_NEW_PAGES_PER_RUN = 1000
MAX_RECHECKS_PER_RUN = 50

_JSON_LD_EMPLOYMENT = {
    "FULL_TIME": JobEmploymentType.FULL_TIME,
    "PART_TIME": JobEmploymentType.PART_TIME,
    "CONTRACTOR": JobEmploymentType.CONTRACT,
    "TEMPORARY": JobEmploymentType.CONTRACT,
    "INTERN": JobEmploymentType.INTERNSHIP,
}


@dataclass(frozen=True)
class Posting:
    """One employer posting, already reduced to what the catalog needs."""

    external_id: str
    title: str
    location: str
    countries: tuple[str, ...]  # explicit country names or codes, when given
    description: str  # HTML or plain text
    url: str
    posted: datetime | None
    employment: JobEmploymentType
    remote: bool
    expired: bool = False  # the source says it closed (schema.org validThrough)


@dataclass(frozen=True)
class CareerSiteFetch:
    postings: tuple[Posting, ...]
    retained: frozenset[str] = frozenset()
    skipped_outside_market: int = 0


@dataclass(frozen=True)
class _Limits:
    pause: float
    max_new_pages: int
    max_rechecks: int


async def _json(
    client: httpx.AsyncClient, board: SourceBoard, url: str, params: Mapping[str, Any]
) -> Any:
    try:
        response = await client.get(url, params=dict(params), headers=_headers())
    except httpx.HTTPError as error:
        raise BoardFetchError(f"{board.token}: {type(error).__name__}") from error
    if response.status_code != 200:
        raise BoardFetchError(f"{board.token}: HTTP {response.status_code}")
    try:
        return response.json()
    except ValueError as error:
        raise BoardFetchError(f"{board.token}: invalid JSON") from error


def _headers() -> dict[str, str]:
    return {"User-Agent": USER_AGENT, "Accept": "application/json"}


def _require(robots: Robots, board: SourceBoard, *urls: str) -> None:
    for url in urls:
        if not robots.allows(url):
            raise BoardFetchError(f"{board.token}: robots.txt disallows {url}")


def _epoch_seconds(value: Any, observed_at: datetime) -> datetime | None:
    return posted_moment(value * 1000, observed_at) if isinstance(value, int | float) else None


# --- Amazon ----------------------------------------------------------------

AMAZON = "https://www.amazon.jobs"
AMAZON_QUERY_CAP = 10_000
AMAZON_PAGE = 100


def _amazon_posting(board: SourceBoard, raw: dict[str, Any], moment: datetime) -> Posting | None:
    job_id = text_value(raw.get("id_icims"))
    path = text_value(raw.get("job_path"))
    if not job_id or not path.startswith("/"):
        return None
    sections = [text_value(raw.get("description"))]
    for heading, key in (
        ("Basic qualifications", "basic_qualifications"),
        ("Preferred qualifications", "preferred_qualifications"),
    ):
        if text_value(raw.get(key)):
            sections.append(f"<h3>{heading}</h3>{text_value(raw.get(key))}")
    posted: datetime | None = None
    try:
        posted = datetime.strptime(text_value(raw.get("posted_date")), "%B %d, %Y").replace(
            tzinfo=UTC
        )
    except ValueError:
        pass
    schedule = text_value(raw.get("job_schedule_type")).lower()
    title = text_value(raw.get("title"))
    if employment_from_title(title) == JobEmploymentType.INTERNSHIP:
        employment = JobEmploymentType.INTERNSHIP
    elif schedule == "part-time":
        employment = JobEmploymentType.PART_TIME
    elif schedule == "full-time":
        employment = JobEmploymentType.FULL_TIME
    else:
        employment = JobEmploymentType.UNKNOWN
    return Posting(
        external_id=f"{board.external_id_prefix}{job_id}",
        title=title,
        location=text_value(raw.get("normalized_location")) or text_value(raw.get("location")),
        countries=(text_value(raw.get("country_code")),),
        description="".join(sections),
        url=f"{AMAZON}{path}",
        posted=posted_moment(posted.isoformat(), moment) if posted else None,
        employment=employment,
        remote=False,
    )


async def fetch_amazon(
    client: httpx.AsyncClient, board: SourceBoard, known: Mapping[str, str], limits: _Limits
) -> CareerSiteFetch:
    search = f"{AMAZON}/en/search.json"
    robots = await load_robots(client, board, AMAZON)
    _require(robots, board, search, f"{AMAZON}/en/jobs/1")
    moment = datetime.now(UTC)
    postings: dict[str, Posting] = {}
    complete = True
    for country in ("USA", "CAN"):
        base = {"normalized_country_code[]": country, "result_limit": AMAZON_PAGE}
        await asyncio.sleep(limits.pause)
        head = await _json(
            client, board, search, {**base, "result_limit": 1, "facets[]": "category"}
        )
        hits = int(head.get("hits") or 0)
        queries: list[dict[str, Any]] = [{}]
        if hits >= AMAZON_QUERY_CAP:
            facet = (head.get("facets") or {}).get("category_facet") or []
            queries = [{"category[]": name} for item in facet for name in item]
            if not queries:
                complete = False
                queries = [{}]
        for extra in queries:
            offset, total = 0, None
            while total is None or offset < min(total, AMAZON_QUERY_CAP):
                await asyncio.sleep(limits.pause)
                page = await _json(client, board, search, {**base, **extra, "offset": offset})
                total = int(page.get("hits") or 0)
                if total >= AMAZON_QUERY_CAP:
                    complete = False
                jobs = page.get("jobs")
                if not isinstance(jobs, list):
                    raise BoardFetchError(f"{board.token}: unexpected Amazon payload")
                if not jobs:
                    break
                for raw in jobs:
                    posting = _amazon_posting(board, raw, moment) if isinstance(raw, dict) else None
                    if posting is not None:
                        postings[posting.external_id] = posting
                offset += len(jobs)
    retained: set[str] = set()
    if not complete:
        missing = {key: url for key, url in known.items() if key not in postings}
        retained = await recheck_missing(
            client,
            board,
            missing,
            still_open=lambda response: True,
            pause=limits.pause,
            limit=limits.max_rechecks,
        )
    return CareerSiteFetch(tuple(postings.values()), frozenset(retained))


# --- Eightfold (Microsoft, PayPal, Netflix) ------------------------------------


@dataclass(frozen=True)
class _EightfoldSite:
    host: str
    domain: str
    api: str  # "pcsx" (current search API) or "v2" (older /api/apply/v2 API)
    # pcsx sites that filter by place server-side; None reads everything and
    # filters here.
    locations: tuple[str, ...] | None = None


_EIGHTFOLD_SITES = {
    "microsoft": _EightfoldSite(
        "https://apply.careers.microsoft.com", "microsoft.com", "pcsx", ("United States", "Canada")
    ),
    "paypal": _EightfoldSite("https://paypal.eightfold.ai", "paypal.com", "pcsx"),
    "netflix": _EightfoldSite("https://explore.jobs.netflix.net", "netflix.com", "v2"),
    **{
        token: _EightfoldSite(
            f"https://{token}.eightfold.ai", domain, "pcsx", ("United States", "Canada")
        )
        for token, domain in (
            ("nvidia", "nvidia.com"),
            ("qualcomm", "qualcomm.com"),
            ("morganstanley", "morganstanley.com"),
            ("citi", "citi.com"),
            ("hp", "hp.com"),
            ("ford", "ford.com"),
            ("starbucks", "starbucks.com"),
            ("caci", "caci.com"),
            ("lamresearch", "lamresearch.com"),
            ("bms", "bms.com"),
        )
    },
}
_NA_CODES = ("US", "CA")


def _country_codes(raw: dict[str, Any]) -> tuple[str, ...]:
    """Country codes from pcsx ``standardizedLocations`` (``"US"`` or ``"Toronto, ON, CA"``)."""
    codes = (
        str(item).rsplit(",", 1)[-1].strip() for item in raw.get("standardizedLocations") or []
    )
    return tuple(dict.fromkeys(code for code in codes if code))


def _v2_places(raw: dict[str, Any]) -> list[str]:
    """v2 locations look like ``"Los Gatos,California"``; normalise the commas."""
    items = raw.get("locations") or [raw.get("location")]
    return [", ".join(part.strip() for part in str(item).split(",")) for item in items if item]


def _first(value: Any) -> str:
    if isinstance(value, list):
        value = value[0] if value else ""
    return text_value(value)


def _eightfold_employment(kind: str, title: str) -> JobEmploymentType:
    kind = kind.lower()
    if "intern" in kind or employment_from_title(title) == JobEmploymentType.INTERNSHIP:
        return JobEmploymentType.INTERNSHIP
    if "full" in kind:
        return JobEmploymentType.FULL_TIME
    if "part" in kind:
        return JobEmploymentType.PART_TIME
    if "contract" in kind or "temp" in kind:
        return JobEmploymentType.CONTRACT
    return JobEmploymentType.UNKNOWN


async def _eightfold_list(
    client: httpx.AsyncClient, board: SourceBoard, site: _EightfoldSite, limits: _Limits
) -> tuple[dict[str, dict[str, Any]], int]:
    """North American positions by external id, and how many were skipped."""
    listed: dict[str, dict[str, Any]] = {}
    outside = 0
    if site.api == "pcsx":
        url, page_key = f"{site.host}/api/pcsx/search", "start"
        passes: list[dict[str, Any]] = [
            {"location": location} for location in site.locations or ()
        ] or [{}]
        base: dict[str, Any] = {"domain": site.domain, "query": ""}
    else:
        url, page_key = f"{site.host}/api/apply/v2/jobs", "start"
        passes = [{"num": 100}]
        base = {"domain": site.domain}
    for extra in passes:
        start, count = 0, None
        while count is None or start < count:
            await asyncio.sleep(limits.pause)
            payload = await _json(client, board, url, {**base, **extra, page_key: start})
            data = (
                payload.get("data") if site.api == "pcsx" and isinstance(payload, dict) else payload
            )
            positions = data.get("positions") if isinstance(data, dict) else None
            if not isinstance(data, dict) or not isinstance(positions, list):
                raise BoardFetchError(f"{board.token}: unexpected Eightfold payload")
            count = int(data.get("count") or 0)
            if not positions:
                break
            for raw in positions:
                if not isinstance(raw, dict) or raw.get("id") is None:
                    continue
                if site.api == "pcsx":
                    north_american = any(code in _NA_CODES for code in _country_codes(raw))
                else:
                    north_american = any(
                        resolve_north_america([place]) is not None for place in _v2_places(raw)
                    )
                if not north_american:
                    outside += 1
                    continue
                listed[f"{board.external_id_prefix}{raw['id']}"] = raw
            start += len(positions)
    return listed, outside


async def fetch_eightfold(
    client: httpx.AsyncClient, board: SourceBoard, known: Mapping[str, str], limits: _Limits
) -> CareerSiteFetch:
    """Eightfold career sites, whose ``robots.txt`` disallows everything except
    ``/careers`` and the ``/api/pcsx`` / ``/api/apply`` endpoints read here."""
    site = _EIGHTFOLD_SITES[board.token]
    api_root = f"{site.host}/api/pcsx" if site.api == "pcsx" else f"{site.host}/api/apply/v2/jobs"
    robots = await load_robots(client, board, site.host)
    _require(robots, board, f"{api_root}/x", f"{site.host}/careers/job/1")
    moment = datetime.now(UTC)
    listed, outside = await _eightfold_list(client, board, site, limits)

    postings: list[Posting] = []
    fetched = 0
    for external_id, raw in listed.items():
        if external_id in known or fetched >= limits.max_new_pages:
            continue
        fetched += 1
        await asyncio.sleep(limits.pause)
        try:
            if site.api == "pcsx":
                payload = await _json(
                    client,
                    board,
                    f"{api_root}/position_details",
                    {"position_id": raw["id"], "domain": site.domain},
                )
                detail = payload.get("data") if isinstance(payload, dict) else None
            else:
                detail = await _json(
                    client, board, f"{api_root}/{raw['id']}", {"domain": site.domain}
                )
        except BoardFetchError:
            continue  # one bad detail must not fail the whole site
        if not isinstance(detail, dict):
            continue
        title = text_value(detail.get("name")) or text_value(raw.get("name"))
        if site.api == "pcsx":
            places = [str(item) for item in raw.get("locations") or []]
            countries = _country_codes(raw)
            description = text_value(detail.get("jobDescription"))
            kind = _first(detail.get("efcustomTextEmploymentType"))
            work_site = " ".join(str(item) for item in detail.get("efcustomTextWorkSite") or [])
            posted = _epoch_seconds(raw.get("postedTs"), moment)
        else:
            places = _v2_places(raw)
            countries = ()
            description = text_value(detail.get("job_description"))
            kind, work_site = "", ""
            posted = _epoch_seconds(raw.get("t_create"), moment)
        postings.append(
            Posting(
                external_id=external_id,
                title=title,
                location=" · ".join(places),
                countries=countries,
                description=description,
                url=f"{site.host}/careers/job/{raw['id']}",
                posted=posted,
                employment=_eightfold_employment(kind, title),
                remote="remote" in work_site.lower()
                or text_value(
                    raw.get("workLocationOption") or raw.get("work_location_option")
                ).lower()
                == "remote",
            )
        )
    retained = frozenset(key for key in listed if key in known)
    return CareerSiteFetch(tuple(postings), retained, outside)


# --- sitemap-based sites (Meta, Apple) ---------------------------------------


def _json_ld_places(posting: dict[str, Any]) -> tuple[str, tuple[str, ...]]:
    places = posting.get("jobLocation")
    items = places if isinstance(places, list) else [places]
    labels: list[str] = []
    countries: list[str] = []
    for place in items:
        if not isinstance(place, dict):
            continue
        raw_address = place.get("address")
        address: dict[str, Any] = raw_address if isinstance(raw_address, dict) else {}
        country = address.get("addressCountry")
        if isinstance(country, dict):
            country = country.get("name") or country.get("identifier")
        label = text_value(place.get("name")) or ", ".join(
            part
            for part in (
                text_value(address.get("addressLocality")),
                text_value(address.get("addressRegion")),
                text_value(country),
            )
            if part
        )
        if label:
            labels.append(label)
        if text_value(country):
            countries.append(text_value(country))
    return " · ".join(dict.fromkeys(labels)), tuple(countries)


def posting_from_json_ld(
    external_id: str, url: str, posting: dict[str, Any], moment: datetime
) -> Posting:
    location, countries = _json_ld_places(posting)
    employment = posting.get("employmentType")
    if isinstance(employment, list):
        employment = employment[0] if employment else ""
    title = text_value(posting.get("title"))
    return Posting(
        external_id=external_id,
        title=title,
        location=location,
        countries=countries,
        description=text_value(posting.get("description")),
        url=url,
        posted=posted_moment(posting.get("datePosted"), moment),
        employment=_JSON_LD_EMPLOYMENT.get(text_value(employment).upper())
        or employment_from_title(title),
        remote=text_value(posting.get("jobLocationType")).upper() == "TELECOMMUTE",
        expired=json_ld_expired(posting, moment),
    )


_APPLE_DATA = re.compile(r'window\.__staticRouterHydrationData\s*=\s*JSON\.parse\("(.*?)"\);', re.S)


def apple_posting(page: str) -> dict[str, Any] | None:
    """The posting object Apple embeds in a job page's router data."""
    match = _APPLE_DATA.search(page)
    if not match:
        return None
    try:
        data = json.loads(json.loads(f'"{match.group(1)}"'))
    except ValueError:
        return None
    stack: list[Any] = [data]
    while stack:
        node = stack.pop()
        if isinstance(node, dict):
            if "postingTitle" in node and "jobNumber" in node:
                return node
            stack.extend(node.values())
        elif isinstance(node, list):
            stack.extend(node)
    return None


def _from_apple(external_id: str, url: str, raw: dict[str, Any], moment: datetime) -> Posting:
    locations = [item for item in raw.get("locations") or [] if isinstance(item, dict)]
    sections = []
    for heading, key in (
        ("", "jobSummary"),
        ("Description", "description"),
        ("Minimum qualifications", "minimumQualifications"),
        ("Preferred qualifications", "preferredQualifications"),
    ):
        text = text_value(raw.get(key))
        if text:
            sections.append(f"{heading}\n{text}" if heading else text)
    title = text_value(raw.get("postingTitle"))
    return Posting(
        external_id=external_id,
        title=title,
        location=" · ".join(text_value(item.get("name")) for item in locations if item.get("name")),
        countries=tuple(
            text_value(item.get("countryName")) or text_value(item.get("code"))
            for item in locations
            if item.get("countryName") or item.get("code")
        ),
        description="\n\n".join(sections),
        url=url,
        posted=posted_moment(raw.get("postDateInGMT"), moment),
        employment=employment_from_title(title),
        remote=raw.get("homeOffice") is True,
    )


@dataclass(frozen=True)
class _SitemapSite:
    origin: str
    sitemap: str
    job_id: re.Pattern[str]
    extract: Callable[[str], dict[str, Any] | None]
    build: Callable[[str, str, dict[str, Any], datetime], Posting]


_SITEMAP_SITES = {
    "meta": _SitemapSite(
        "https://www.metacareers.com",
        "https://www.metacareers.com/jobsearch/sitemap.xml",
        re.compile(r"^https://www\.metacareers\.com/profile/job_details/(\d+)/?$"),
        json_ld_job_posting,
        posting_from_json_ld,
    ),
    "apple": _SitemapSite(
        "https://jobs.apple.com",
        "https://jobs.apple.com/sitemap/sitemap-jobs-en-us.xml",
        re.compile(r"^https://jobs\.apple\.com/en-us/details/([0-9A-Za-z-]+)/[^/?#]*$"),
        apple_posting,
        _from_apple,
    ),
}


async def fetch_sitemap_site(
    client: httpx.AsyncClient, board: SourceBoard, known: Mapping[str, str], limits: _Limits
) -> CareerSiteFetch:
    site = _SITEMAP_SITES[board.token]
    robots = await load_robots(client, board, site.origin)
    _require(robots, board, site.sitemap)
    await asyncio.sleep(limits.pause)
    response = await fetch_page(client, board, site.sitemap)
    if response.status_code != 200:
        raise BoardFetchError(f"{board.token}: sitemap HTTP {response.status_code}")
    listed: dict[str, str] = {}
    for url in sitemap_urls(response.text, board.token):
        match = site.job_id.match(url)
        if match:
            listed.setdefault(f"{board.external_id_prefix}{match.group(1)}", url)
    if not listed:
        raise BoardFetchError(f"{board.token}: sitemap lists no job pages")
    read = await read_listed_pages(
        client,
        board,
        robots,
        listed,
        known,
        complete=True,
        extract=site.extract,
        worth_fetching=lambda url: True,
        pause=limits.pause,
        max_new_pages=limits.max_new_pages,
        max_rechecks=limits.max_rechecks,
    )
    moment = datetime.now(UTC)
    postings = tuple(
        site.build(external_id, url, raw, moment) for external_id, (url, raw) in read.pages.items()
    )
    return CareerSiteFetch(postings, read.retained, read.skipped_outside_market)


# --- dispatch and mapping ------------------------------------------------------

Reader = Callable[
    [httpx.AsyncClient, SourceBoard, Mapping[str, str], _Limits], Awaitable[CareerSiteFetch]
]
READERS: dict[str, Reader] = {
    "amazon": fetch_amazon,
    "microsoft": fetch_eightfold,
    "paypal": fetch_eightfold,
    "netflix": fetch_eightfold,
    "nvidia": fetch_eightfold,
    "qualcomm": fetch_eightfold,
    "morganstanley": fetch_eightfold,
    "citi": fetch_eightfold,
    "hp": fetch_eightfold,
    "ford": fetch_eightfold,
    "starbucks": fetch_eightfold,
    "caci": fetch_eightfold,
    "lamresearch": fetch_eightfold,
    "bms": fetch_eightfold,
    "meta": fetch_sitemap_site,
    "apple": fetch_sitemap_site,
}


async def fetch_site(
    client: httpx.AsyncClient,
    board: SourceBoard,
    known: Mapping[str, str],
    *,
    pause: float = PAUSE_BETWEEN_REQUESTS_SECONDS,
    max_new_pages: int = MAX_NEW_PAGES_PER_RUN,
    max_rechecks: int = MAX_RECHECKS_PER_RUN,
) -> CareerSiteFetch:
    reader = READERS.get(board.token)
    if reader is None:
        raise BoardFetchError(f"{board.token}: no career-site reader for this employer")
    return await reader(client, board, known, _Limits(pause, max_new_pages, max_rechecks))


def _placement(posting: Posting) -> tuple[Any, JobCountry] | None:
    countries: list[JobCountry] = []
    named = [value for value in posting.countries if value]
    for value in named:
        country = north_american_country(value)
        if country is not None:
            countries.append(country)
    if not named:
        placement = resolve_north_america([posting.location])
        if placement is not None:
            countries.append(placement[1])
    return placement_from_countries(countries)


def map_site(payload: Any, board: SourceBoard, observed_at: datetime | None = None) -> BoardMapping:
    if not isinstance(payload, CareerSiteFetch):
        raise BoardFetchError("Unexpected career-site payload")
    moment = observed_at or datetime.now(UTC)
    candidates: list[NormalizedJobCandidate] = []
    outside = payload.skipped_outside_market
    invalid = not_opening = 0
    for posting in payload.postings:
        if posting.expired or is_standing_interest_posting(posting.title):
            not_opening += 1
            continue
        placement = _placement(posting)
        if placement is None:
            outside += 1
            continue
        candidate = build_candidate(
            external_id=posting.external_id,
            board=board,
            title=posting.title,
            location=posting.location,
            description=description_text(posting.description),
            posting_url=posting.url,
            application_url=posting.url,
            placement=placement,
            workplace=JobWorkplaceType.REMOTE
            if posting.remote
            else workplace_from_text(posting.location),
            employment=posting.employment,
            observed_at=moment,
            posted_at=posting.posted,
        )
        if candidate is None:
            invalid += 1
        else:
            candidates.append(candidate)
    return BoardMapping(
        tuple(candidates),
        len(payload.postings) + len(payload.retained) + payload.skipped_outside_market,
        outside,
        invalid,
        not_opening,
        retained_external_ids=payload.retained,
    )


class CareerSiteBoardAdapter(BoardAdapter):
    def __init__(self, mapping: BoardMapping) -> None:
        super().__init__(CAREERSITE_SOURCE_KEY, mapping)
