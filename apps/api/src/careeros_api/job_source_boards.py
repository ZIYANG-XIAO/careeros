"""Shared plumbing for employer ATS job-board sources (Greenhouse, Lever, Ashby, Workday).

Each source module only knows its own URL and payload shape; everything else —
the board seed model, HTML-to-text, the conservative North America placement
rule, candidate construction, and fetching — lives here so the sources behave
identically.
"""

import asyncio
import html
import json
import re
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from html.parser import HTMLParser
from typing import Any
from urllib.parse import urlsplit

import httpx
from pydantic import ValidationError

from careeros_api.job_sources import NormalizedJobCandidate
from careeros_api.job_urls import canonical_clip_url
from careeros_api.models import (
    JobAvailabilityStatus,
    JobCountry,
    JobEmploymentType,
    JobFreshnessStatus,
    JobMarket,
    JobWorkplaceType,
)

USER_AGENT = "CareerOS-JobSync/0.1 (+public job board API; daily)"
MAX_DESCRIPTION = 100_000
_BOARD_TOKEN = re.compile(r"^[a-z0-9][a-z0-9._-]{0,99}$")


class BoardFetchError(RuntimeError):
    """A board could not be fetched or its payload was not the expected shape."""


@dataclass(frozen=True)
class SourceBoard:
    """One employer's board on one ATS, as listed in a seed file."""

    token: str
    company: str
    # Only for sources addressed by a full site URL rather than a token alone
    # (Workday: ``https://{tenant}.wd{N}.myworkdayjobs.com/{site}``).
    site_url: str | None = None

    def __post_init__(self) -> None:
        if not _BOARD_TOKEN.match(self.token):
            raise ValueError(f"Invalid board token: {self.token!r}")
        if not self.company.strip():
            raise ValueError("A board needs a company display name")

    @property
    def external_id_prefix(self) -> str:
        return f"{self.token}:"


@dataclass(frozen=True)
class BoardMapping:
    """One board's mapping result.

    ``seen_external_ids`` holds only the postings kept for the catalog, so a
    sync closes anything no longer kept — gone from the board, moved outside
    North America, or recognised as a standing-interest posting.
    """

    candidates: tuple[NormalizedJobCandidate, ...]
    fetched: int
    skipped_outside_market: int
    skipped_invalid: int
    skipped_not_opening: int = 0
    # Already-catalogued postings still listed (or not yet re-checked) that a
    # source chose not to re-fetch this run. They stay open.
    retained_external_ids: frozenset[str] = frozenset()

    @property
    def seen_external_ids(self) -> frozenset[str]:
        return (
            frozenset(
                candidate.external_job_id
                for candidate in self.candidates
                if candidate.external_job_id is not None
            )
            | self.retained_external_ids
        )


class BoardAdapter:
    """``JobSourceAdapter`` over one already-mapped board."""

    def __init__(self, source_key: str, mapping: BoardMapping) -> None:
        self.source_key = source_key
        self._mapping = mapping

    async def fetch_candidates(self) -> Sequence[NormalizedJobCandidate]:
        return self._mapping.candidates


# --- description text -------------------------------------------------------

_BLOCK_TAGS = {"p", "div", "li", "ul", "ol", "br", "h1", "h2", "h3", "h4", "h5", "h6", "tr"}


class _TextExtractor(HTMLParser):
    def __init__(self) -> None:
        super().__init__(convert_charrefs=True)
        self.parts: list[str] = []
        self._skip = 0

    def handle_starttag(self, tag: str, attrs: list[tuple[str, str | None]]) -> None:
        if tag in {"script", "style"}:
            self._skip += 1
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n")
            if tag == "li":
                self.parts.append("- ")

    def handle_endtag(self, tag: str) -> None:
        if tag in {"script", "style"}:
            self._skip = max(0, self._skip - 1)
        elif tag in _BLOCK_TAGS:
            self.parts.append("\n")

    def handle_data(self, data: str) -> None:
        if not self._skip:
            self.parts.append(data)


def description_text(content: str) -> str:
    """Greenhouse sends entity-escaped HTML; return readable plain text."""
    extractor = _TextExtractor()
    extractor.feed(html.unescape(content))
    extractor.close()
    lines = [re.sub(r"[ \t ]+", " ", line).strip() for line in "".join(extractor.parts).split("\n")]
    text = re.sub(r"\n{3,}", "\n\n", "\n".join(lines)).strip()
    return text[:MAX_DESCRIPTION]


# --- location ----------------------------------------------------------------

_US_STATES = {
    "AL", "AK", "AZ", "AR", "CA", "CO", "CT", "DE", "FL", "GA", "HI", "ID", "IL", "IN",
    "IA", "KS", "KY", "LA", "ME", "MD", "MA", "MI", "MN", "MS", "MO", "MT", "NE", "NV",
    "NH", "NJ", "NM", "NY", "NC", "ND", "OH", "OK", "OR", "PA", "RI", "SC", "SD", "TN",
    "TX", "UT", "VT", "VA", "WA", "WV", "WI", "WY", "DC",
}  # fmt: skip
_CA_PROVINCES = {"ON", "BC", "QC", "AB", "MB", "NS", "NB", "SK", "NL", "PE", "YT", "NT", "NU"}
_US_WORDS = re.compile(r"\b(?:united states|usa|u\.s\.a?\.?|us)\b", re.I)
_CA_WORDS = re.compile(r"\bcanada\b", re.I)
_US_CITIES = re.compile(
    r"\b(?:san francisco|new york(?: city)?|nyc|seattle|austin|boston|chicago|los angeles|"
    r"denver|atlanta|washington,? d\.?c\.?|san jose|palo alto|mountain view|menlo park|"
    r"sunnyvale|oakland|san diego|portland|miami|dallas|houston|philadelphia|pittsburgh|"
    r"salt lake city|raleigh|minneapolis|detroit|phoenix|nashville|boulder)\b",
    re.I,
)
_CA_CITIES = re.compile(
    r"\b(?:toronto|vancouver|montr[eé]al|waterloo|ottawa|calgary|edmonton|kitchener|"
    r"victoria|halifax|winnipeg|qu[eé]bec city)\b",
    re.I,
)
_REGION_CODE = re.compile(r",\s*([A-Z]{2})\b")
# Two-letter state codes collide with ISO country codes ("Berlin, DE" is not
# Delaware), so a piece naming a well-known place outside North America is
# never read as North American.
_ELSEWHERE = re.compile(
    r"\b(?:united kingdom|england|scotland|ireland|germany|france|spain|portugal|"
    r"italy|netherlands|belgium|switzerland|austria|sweden|norway|denmark|finland|"
    r"poland|czech|serbia|romania|israel|india|singapore|japan|korea|china|hong kong|"
    r"taiwan|australia|new zealand|brazil|mexico|argentina|colombia|chile|"
    r"south africa|nigeria|kenya|uae|dubai|philippines|indonesia|vietnam|thailand|"
    r"london|dublin|berlin|munich|paris|amsterdam|madrid|barcelona|lisbon|zurich|"
    r"stockholm|copenhagen|oslo|helsinki|warsaw|krakow|prague|belgrade|tel aviv|"
    r"bengaluru|bangalore|hyderabad|pune|mumbai|tokyo|seoul|shanghai|beijing|"
    r"sydney|melbourne|s[aã]o paulo|mexico city|emea|apac|latam)\b",
    re.I,
)
_PIECE_SEPARATORS = re.compile(r"[•;|/\n]")


_US_STATE_NAMES = re.compile(
    r"\b(?:alabama|alaska|arizona|arkansas|california|colorado|connecticut|delaware|"
    r"florida|hawaii|idaho|illinois|indiana|iowa|kansas|kentucky|louisiana|maine|"
    r"maryland|massachusetts|michigan|minnesota|mississippi|missouri|montana|nebraska|"
    r"nevada|new hampshire|new jersey|new mexico|north carolina|north dakota|ohio|"
    r"oklahoma|oregon|pennsylvania|rhode island|south carolina|south dakota|tennessee|"
    r"texas|utah|vermont|virginia|washington|west virginia|wisconsin|wyoming|"
    r"sf|bay area|silicon valley|bellevue|redmond|brooklyn)\b",
    re.I,
)
_CA_PROVINCE_NAMES = re.compile(
    r"\b(?:ontario|british columbia|quebec|qu[eé]bec|alberta|manitoba|nova scotia|"
    r"new brunswick|saskatchewan|newfoundland|prince edward island)\b",
    re.I,
)
_NORTH_AMERICA_WORDS = re.compile(r"\b(?:north america|namer|us\s*(?:&|and|/)\s*canada)\b", re.I)


def _north_american_piece(piece: str) -> tuple[bool, bool]:
    """US/Canada signals in one location piece.

    Place names count even in a mixed list ("San Francisco, London"); bare
    two-letter region codes count only when the piece names nowhere else,
    because they collide with country codes ("Berlin, DE" is not Delaware).
    """
    elsewhere = bool(_ELSEWHERE.search(piece))
    codes = set() if elsewhere else set(_REGION_CODE.findall(piece))
    both = bool(_NORTH_AMERICA_WORDS.search(piece))
    in_us = both or bool(
        _US_WORDS.search(piece)
        or _US_CITIES.search(piece)
        or _US_STATE_NAMES.search(piece)
        or codes & _US_STATES
    )
    in_ca = both or bool(
        _CA_WORDS.search(piece)
        or _CA_CITIES.search(piece)
        or _CA_PROVINCE_NAMES.search(piece)
        or codes & _CA_PROVINCES
    )
    return in_us, in_ca


_GENERIC_LOCATION = re.compile(
    r"^\W*(?:remote|hybrid|distributed|in[- ]office|on[- ]?site|n/?a|tbd|"
    r"multiple locations|various(?: locations)?|flexible|anywhere)?\W*$",
    re.I,
)


def is_generic_location(text: str) -> bool:
    """True when a location names no place at all ("Remote", "Hybrid", "N/A")."""
    return bool(_GENERIC_LOCATION.match(text or ""))


# Postings that collect interest rather than fill an open role.
_NOT_AN_OPENING = re.compile(
    r"general application|talent (?:pool|community|network)|join our talent|"
    r"future (?:opportunit|consideration|roles?\b)|expression of interest|"
    r"don'?t see (?:the|a|your)|open application|resume drop|speculative application|"
    r"stay in touch|keep in touch|\bevergreen\b",
    re.I,
)
# A posting first published this long ago is treated as an always-open
# listing rather than a current opening, even if the employer still lists it.
STALE_AFTER = timedelta(days=365)


def is_stale_posting(posted_at: datetime | None, observed_at: datetime) -> bool:
    return posted_at is not None and posted_at < observed_at - STALE_AFTER


def json_ld_expired(posting: dict[str, Any], observed_at: datetime) -> bool:
    """True when a schema.org posting's ``validThrough`` has passed."""
    value = posting.get("validThrough")
    if not isinstance(value, str) or not value.strip():
        return False
    try:
        until = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
    except ValueError:
        return False
    if until.tzinfo is None:
        until = until.replace(tzinfo=UTC)
    return until < observed_at


def without_stale(mapping: "BoardMapping", observed_at: datetime) -> "BoardMapping":
    """Drop candidates first published more than ``STALE_AFTER`` ago.

    They leave ``seen_external_ids`` too, so a sync closes any such posting
    already in the catalog.
    """
    kept = tuple(c for c in mapping.candidates if not is_stale_posting(c.posted_at, observed_at))
    if len(kept) == len(mapping.candidates):
        return mapping
    return BoardMapping(
        kept,
        mapping.fetched,
        mapping.skipped_outside_market,
        mapping.skipped_invalid,
        mapping.skipped_not_opening + len(mapping.candidates) - len(kept),
        retained_external_ids=mapping.retained_external_ids,
    )


def is_standing_interest_posting(title: str) -> bool:
    return bool(_NOT_AN_OPENING.search(title or ""))


def resolve_north_america(texts: Sequence[str]) -> tuple[JobMarket, JobCountry] | None:
    """Return the market and country only when the text explicitly says so."""
    in_us = in_ca = False
    for text in texts:
        for piece in _PIECE_SEPARATORS.split(text or ""):
            us, ca = _north_american_piece(piece)
            in_us, in_ca = in_us or us, in_ca or ca
    if in_us and in_ca:
        return JobMarket.NORTH_AMERICA, JobCountry.UNKNOWN
    if in_us:
        return JobMarket.NORTH_AMERICA, JobCountry.US
    if in_ca:
        return JobMarket.NORTH_AMERICA, JobCountry.CA
    return None


_COUNTRY_NAMES = {
    "US": JobCountry.US,
    "USA": JobCountry.US,
    "UNITED STATES": JobCountry.US,
    "UNITED STATES OF AMERICA": JobCountry.US,
    "CA": JobCountry.CA,
    "CAN": JobCountry.CA,
    "CANADA": JobCountry.CA,
}


def north_american_country(value: Any) -> JobCountry | None:
    """Map an explicit country code/name; None when it names somewhere else."""
    if not isinstance(value, str) or not value.strip():
        return None
    return _COUNTRY_NAMES.get(value.strip().upper())


def placement_from_countries(
    countries: Sequence[JobCountry],
) -> tuple[JobMarket, JobCountry] | None:
    """North America with a country when every placement agrees, else UNKNOWN.

    An UNKNOWN entry means "somewhere in North America" (for example a label
    naming both the US and Canada).
    """
    unique = set(countries)
    if not unique:
        return None
    if len(unique) == 1:
        return JobMarket.NORTH_AMERICA, unique.pop()
    return JobMarket.NORTH_AMERICA, JobCountry.UNKNOWN


def workplace_from_text(location: str) -> JobWorkplaceType:
    lowered = location.lower()
    if "hybrid" in lowered:
        return JobWorkplaceType.HYBRID
    if "remote" in lowered:
        return JobWorkplaceType.REMOTE
    return JobWorkplaceType.UNKNOWN


_INTERN = re.compile(r"\bintern(?:ship)?s?\b", re.I)


def employment_from_title(title: str) -> JobEmploymentType:
    return JobEmploymentType.INTERNSHIP if _INTERN.search(title) else JobEmploymentType.UNKNOWN


def text_value(value: Any) -> str:
    return value.strip() if isinstance(value, str) else ""


def posted_moment(value: Any, observed_at: datetime) -> datetime | None:
    """A source's publish time (ISO 8601 string or epoch milliseconds).

    Anything unparseable, naive, before 2000, or more than a day after the
    sync is treated as unknown rather than guessed.
    """
    moment: datetime | None = None
    if isinstance(value, bool):
        return None
    if isinstance(value, int | float):
        try:
            moment = datetime.fromtimestamp(value / 1000, tz=UTC)
        except (OverflowError, OSError, ValueError):
            return None
    elif isinstance(value, str) and value.strip():
        try:
            moment = datetime.fromisoformat(value.strip().replace("Z", "+00:00"))
        except ValueError:
            return None
    if moment is None or moment.tzinfo is None:
        return None
    if moment.year < 2000 or moment > observed_at + timedelta(days=1):
        return None
    return moment


# --- candidates and fetching -----------------------------------------------


def build_candidate(
    *,
    external_id: str,
    board: SourceBoard,
    title: str,
    location: str,
    description: str,
    posting_url: str,
    application_url: str,
    placement: tuple[JobMarket, JobCountry],
    workplace: JobWorkplaceType,
    employment: JobEmploymentType,
    observed_at: datetime,
    posted_at: datetime | None = None,
) -> NormalizedJobCandidate | None:
    """A catalog candidate, or None when the posting fails the shared contract."""
    market, country = placement
    try:
        return NormalizedJobCandidate.model_validate(
            {
                "external_job_id": external_id,
                "company": board.company[:500],
                "title": title[:500],
                "location": location[:500] or None,
                "description": description,
                "source_url": posting_url or None,
                "application_url": application_url or posting_url or None,
                "canonical_url": canonical_clip_url(posting_url) if posting_url else None,
                "observed_at": observed_at,
                "posted_at": posted_at,
                "availability_status": JobAvailabilityStatus.AVAILABLE,
                "freshness_status": JobFreshnessStatus.CURRENT,
                "market": market,
                "country_code": country,
                "workplace_type": workplace,
                "employment_type": employment,
            }
        )
    except ValidationError:
        return None


async def fetch_json(
    client: httpx.AsyncClient, board: SourceBoard, url: str, params: dict[str, str] | None = None
) -> Any:
    """GET a board's public JSON. Raises on any non-200 or bad JSON."""
    try:
        response = await client.get(
            url,
            params=params,
            headers={"User-Agent": USER_AGENT, "Accept": "application/json"},
        )
    except httpx.HTTPError as error:
        raise BoardFetchError(f"{board.token}: {type(error).__name__}") from error
    if response.status_code != 200:
        raise BoardFetchError(f"{board.token}: HTTP {response.status_code}")
    try:
        return response.json()
    except ValueError as error:
        raise BoardFetchError(f"{board.token}: invalid JSON") from error


# --- HTML career pages (sitemap + structured data) ---------------------------

_LOC = re.compile(r"<loc>\s*([^<\s]+)\s*</loc>")
_JSON_LD = re.compile(r'<script[^>]*type="application/ld\+json"[^>]*>(.*?)</script>', re.S)


async def fetch_page(client: httpx.AsyncClient, board: SourceBoard, url: str) -> httpx.Response:
    """GET one page as CareerOS. Raises ``BoardFetchError`` on network failure."""
    try:
        return await client.get(url, headers={"User-Agent": USER_AGENT}, follow_redirects=True)
    except httpx.HTTPError as error:
        raise BoardFetchError(f"{board.token}: {type(error).__name__}") from error


async def fetch_page_retrying(
    client: httpx.AsyncClient, board: SourceBoard, url: str, pause: float
) -> httpx.Response | None:
    """One page, retried once; None when the network fails both times.

    A single bad page must not fail a whole site and discard pages already read.
    """
    for attempt in range(2):
        try:
            return await fetch_page(client, board, url)
        except BoardFetchError:
            if attempt == 0:
                await asyncio.sleep(pause * 3)
    return None


class Robots:
    """robots.txt rules for CareerOS, per RFC 9309.

    The group naming our product token applies, else the ``*`` group. Within
    it the longest matching rule wins and ``Allow`` wins a tie; ``*`` and a
    trailing ``$`` are supported. (``urllib.robotparser`` instead takes the
    first matching line, which misreads ``Disallow: /`` followed by
    ``Allow: /api``.)
    """

    PRODUCT_TOKEN = "careeros-jobsync"

    def __init__(self, text: str) -> None:
        groups: list[tuple[list[str], list[tuple[bool, str]]]] = []
        agents: list[str] = []
        rules: list[tuple[bool, str]] = []
        for raw in text.splitlines():
            line = raw.split("#", 1)[0].strip()
            if ":" not in line:
                continue
            key, value = (part.strip() for part in line.split(":", 1))
            key = key.lower()
            if key == "user-agent":
                if rules:
                    groups.append((agents, rules))
                    agents, rules = [], []
                agents.append(value.lower())
            elif key in ("allow", "disallow") and agents:
                if value:
                    rules.append((key == "allow", value))
        if agents:
            groups.append((agents, rules))
        mine = [
            r for a, r in groups if any(self.PRODUCT_TOKEN.startswith(x) and x != "*" for x in a)
        ]
        anyone = [r for a, r in groups if "*" in a]
        chosen = mine or anyone
        self._rules = [rule for group in chosen for rule in group]

    @staticmethod
    def _pattern(path: str) -> re.Pattern[str]:
        anchored = path.endswith("$")
        body = re.escape(path[:-1] if anchored else path).replace(r"\*", ".*")
        return re.compile(body + ("$" if anchored else ""))

    def allows(self, url: str) -> bool:
        parts = urlsplit(url)
        target = (parts.path or "/") + (f"?{parts.query}" if parts.query else "")
        best: tuple[int, bool] | None = None
        for allow, path in self._rules:
            if self._pattern(path).match(target):
                rank = (len(path), allow)
                if best is None or rank > best:
                    best = rank
        return True if best is None else best[1]


async def load_robots(client: httpx.AsyncClient, board: SourceBoard, origin: str) -> Robots:
    """The origin's robots.txt, per RFC 9309 section 2.3.1: a 4xx answer (other
    than 429) means no rules apply; a 429, 5xx, or network failure fails the
    board rather than guessing."""
    response = await fetch_page(client, board, f"{origin}/robots.txt")
    status = response.status_code
    if status == 200:
        # Some sites answer 200 with an HTML page; that holds no rules either.
        html_page = "<html" in response.text[:500].lower()
        return Robots("" if html_page else response.text)
    if 400 <= status < 500 and status != 429:
        return Robots("")
    raise BoardFetchError(f"{board.token}: robots.txt HTTP {status}")


def sitemap_urls(xml: str, where: str) -> list[str]:
    """Every ``<loc>`` in a sitemap urlset, in order and de-duplicated."""
    if "<urlset" not in xml:
        raise BoardFetchError(f"{where}: sitemap is not a urlset")
    return list(dict.fromkeys(_LOC.findall(xml)))


def json_ld_job_posting(page: str) -> dict[str, Any] | None:
    """The schema.org ``JobPosting`` embedded in a page, if any."""
    for block in _JSON_LD.findall(page):
        try:
            data = json.loads(block)
        except ValueError:
            continue
        for item in data if isinstance(data, list) else [data]:
            if isinstance(item, dict) and item.get("@type") == "JobPosting":
                return item
    return None


@dataclass(frozen=True)
class ListedPages:
    """Pages read for one listing of job URLs, before mapping."""

    pages: Mapping[str, tuple[str, dict[str, Any]]]  # external id -> (URL, posting)
    retained: frozenset[str]
    skipped_outside_market: int


async def read_listed_pages(
    client: httpx.AsyncClient,
    board: SourceBoard,
    robots: Robots,
    listed: Mapping[str, str],
    known: Mapping[str, str],
    *,
    complete: bool,
    extract: Callable[[str], dict[str, Any] | None],
    worth_fetching: Callable[[str], bool],
    pause: float,
    max_new_pages: int,
    max_rechecks: int,
) -> ListedPages:
    """Read the job pages a listing (usually a sitemap) points to, incrementally.

    ``listed`` and ``known`` map external ids to URLs; ``known`` holds postings
    already open in the catalog, which are not re-fetched. When the listing is
    ``complete``, a known posting missing from it is simply not retained (so
    the caller closes it). Otherwise absence proves nothing: a bounded number
    of missing postings are re-checked and only those whose page is gone
    (404/410, or no posting) are dropped; the rest stay open.
    """
    pages: dict[str, tuple[str, dict[str, Any]]] = {}
    retained = set(listed).intersection(known)
    outside = 0
    for external_id, url in listed.items():
        if external_id in known:
            continue
        if not worth_fetching(url):
            outside += 1
            continue
        if len(pages) >= max_new_pages or not robots.allows(url):
            continue
        await asyncio.sleep(pause)
        page = await fetch_page_retrying(client, board, url, pause)
        posting = extract(page.text) if page is not None and page.status_code == 200 else None
        if posting is not None:
            pages[external_id] = (url, posting)

    if not complete:
        unlisted = [external_id for external_id in known if external_id not in listed]
        for index, external_id in enumerate(unlisted):
            if index >= max_rechecks:
                retained.update(unlisted[index:])
                break
            await asyncio.sleep(pause)
            page = await fetch_page_retrying(client, board, known[external_id], pause)
            if page is None or page.status_code not in (200, 404, 410):
                retained.add(external_id)  # a network or server error proves nothing
            elif page.status_code == 200 and extract(page.text) is not None:
                retained.add(external_id)
    return ListedPages(pages, frozenset(retained), outside)


async def recheck_missing(
    client: httpx.AsyncClient,
    board: SourceBoard,
    missing: Mapping[str, str],
    *,
    still_open: Callable[[httpx.Response], bool],
    pause: float,
    limit: int,
) -> set[str]:
    """Which known postings absent from an incomplete listing should stay open.

    At most ``limit`` pages are re-checked; a posting is dropped only when its
    page answers 404/410 or a 200 that ``still_open`` rejects. Network errors,
    other statuses, and postings beyond the limit stay open.
    """
    keep: set[str] = set()
    for index, (external_id, url) in enumerate(missing.items()):
        if index >= limit:
            keep.update(list(missing)[index:])
            break
        await asyncio.sleep(pause)
        page = await fetch_page_retrying(client, board, url, pause)
        if page is None or page.status_code not in (200, 404, 410):
            keep.add(external_id)
        elif page.status_code == 200 and still_open(page):
            keep.add(external_id)
    return keep
