"""Shared plumbing for employer ATS job-board sources (Greenhouse, Lever, Ashby).

Each source module only knows its own URL and payload shape; everything else —
the board seed model, HTML-to-text, the conservative North America placement
rule, candidate construction, and fetching — lives here so the sources behave
identically.
"""

import html
import re
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import datetime
from html.parser import HTMLParser
from typing import Any

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

    @property
    def seen_external_ids(self) -> frozenset[str]:
        return frozenset(
            candidate.external_job_id
            for candidate in self.candidates
            if candidate.external_job_id is not None
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
    r"stay in touch|keep in touch",
    re.I,
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
