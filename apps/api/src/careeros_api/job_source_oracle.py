"""Oracle Recruiting Cloud career sites (North America).

An Oracle Recruiting career site
(``https://{host}.oraclecloud.com/hcmUI/CandidateExperience/en/sites/{site}``)
loads its listings from the public ``recruitingCEJobRequisitions`` REST
resource and each posting from ``recruitingCEJobRequisitionDetails``; this
reader uses the same two, after checking ``robots.txt``. See
``docs/JOB_SOURCE_DECISION.md``.

The list is paged to its reported total, so it is complete and absence
closes a posting. Details are fetched only for new postings.
"""

import asyncio
import re
from collections.abc import Mapping
from datetime import UTC, datetime
from typing import Any

import httpx

from careeros_api.job_source_boards import (
    USER_AGENT,
    BoardAdapter,
    BoardFetchError,
    BoardMapping,
    SourceBoard,
    employment_from_title,
    load_robots,
    posted_moment,
    text_value,
)
from careeros_api.job_source_careersite import CareerSiteFetch, Posting, map_site
from careeros_api.models import JobEmploymentType

ORACLE_SOURCE_KEY = "oracle"
PAUSE_BETWEEN_REQUESTS_SECONDS = 1.0
MAX_NEW_PAGES_PER_RUN = 1500
PAGE_SIZE = 200
_NA = ("US", "CA")

_SITE = re.compile(
    r"^https://([a-z0-9.-]+\.oraclecloud\.com)/hcmUI/CandidateExperience/[A-Za-z-]+/sites/([A-Za-z0-9_]+)$"
)


def _site(board: SourceBoard) -> tuple[str, str]:
    match = _SITE.match(board.site_url or "")
    if not match:
        raise BoardFetchError(f"{board.token}: missing or invalid Oracle site_url")
    return f"https://{match.group(1)}", match.group(2)


async def _json(
    client: httpx.AsyncClient, board: SourceBoard, url: str, params: dict[str, str]
) -> Any:
    try:
        response = await client.get(
            url, params=params, headers={"User-Agent": USER_AGENT, "Accept": "application/json"}
        )
    except httpx.HTTPError as error:
        raise BoardFetchError(f"{board.token}: {type(error).__name__}") from error
    if response.status_code != 200:
        raise BoardFetchError(f"{board.token}: HTTP {response.status_code}")
    try:
        return response.json()
    except ValueError as error:
        raise BoardFetchError(f"{board.token}: invalid JSON") from error


def _countries(raw: dict[str, Any]) -> tuple[str, ...]:
    codes = [text_value(raw.get("PrimaryLocationCountry"))]
    for item in raw.get("secondaryLocations") or []:
        if isinstance(item, dict):
            codes.append(text_value(item.get("CountryCode")))
    return tuple(dict.fromkeys(code for code in codes if code))


def _first_item(payload: Any) -> dict[str, Any] | None:
    items = payload.get("items") if isinstance(payload, dict) else None
    if isinstance(items, list) and items and isinstance(items[0], dict):
        return items[0]
    return None


def _employment(schedule: str, title: str) -> JobEmploymentType:
    schedule = schedule.lower()
    if employment_from_title(title) == JobEmploymentType.INTERNSHIP:
        return JobEmploymentType.INTERNSHIP
    if "full" in schedule:
        return JobEmploymentType.FULL_TIME
    if "part" in schedule:
        return JobEmploymentType.PART_TIME
    return JobEmploymentType.UNKNOWN


async def fetch_site(
    client: httpx.AsyncClient,
    board: SourceBoard,
    known: Mapping[str, str],
    *,
    pause: float = PAUSE_BETWEEN_REQUESTS_SECONDS,
    max_new_pages: int = MAX_NEW_PAGES_PER_RUN,
    max_rechecks: int = 0,
) -> CareerSiteFetch:
    """Read one site. ``known`` maps already-open catalog ids to their URLs."""
    origin, site = _site(board)
    api = f"{origin}/hcmRestApi/resources/latest"
    robots = await load_robots(client, board, origin)
    for path in (f"{api}/recruitingCEJobRequisitions", board.site_url or ""):
        if not robots.allows(path):
            raise BoardFetchError(f"{board.token}: robots.txt disallows {path}")

    listed: dict[str, dict[str, Any]] = {}
    outside, offset, total = 0, 0, None
    while total is None or offset < total:
        await asyncio.sleep(pause)
        payload = await _json(
            client,
            board,
            f"{api}/recruitingCEJobRequisitions",
            {
                "onlyData": "true",
                "expand": "requisitionList.secondaryLocations",
                "finder": f"findReqs;siteNumber={site},limit={PAGE_SIZE},offset={offset},"
                "sortBy=POSTING_DATES_DESC",
            },
        )
        item = _first_item(payload)
        page = item.get("requisitionList") if item else None
        if item is None or not isinstance(page, list):
            raise BoardFetchError(f"{board.token}: unexpected Oracle payload")
        total = int(item.get("TotalJobsCount") or 0)
        if not page:
            break
        for raw in page:
            if not isinstance(raw, dict) or not text_value(raw.get("Id")):
                continue
            if not any(code in _NA for code in _countries(raw)):
                outside += 1
                continue
            listed[f"{board.external_id_prefix}{raw['Id']}"] = raw
        offset += len(page)

    moment = datetime.now(UTC)
    postings: list[Posting] = []
    fetched = 0
    for external_id, raw in listed.items():
        if external_id in known or fetched >= max_new_pages:
            continue
        fetched += 1
        await asyncio.sleep(pause)
        try:
            detail = _first_item(
                await _json(
                    client,
                    board,
                    f"{api}/recruitingCEJobRequisitionDetails",
                    {
                        "expand": "all",
                        "onlyData": "true",
                        "finder": f'ById;Id="{raw["Id"]}",siteNumber={site}',
                    },
                )
            )
        except BoardFetchError:
            continue  # one bad detail must not fail the whole site
        if detail is None:
            continue
        sections = [
            text_value(detail.get(key))
            for key in (
                "ExternalDescriptionStr",
                "ExternalResponsibilitiesStr",
                "ExternalQualificationsStr",
            )
        ]
        title = text_value(detail.get("Title")) or text_value(raw.get("Title"))
        end = posted_moment(detail.get("ExternalPostedEndDate"), moment)
        postings.append(
            Posting(
                external_id=external_id,
                title=title,
                location=text_value(raw.get("PrimaryLocation")),
                countries=_countries(raw),
                description="".join(section for section in sections if section),
                url=f"{board.site_url}/job/{raw['Id']}",
                posted=posted_moment(detail.get("ExternalPostedStartDate"), moment),
                employment=_employment(text_value(detail.get("JobSchedule")), title),
                remote="remote" in text_value(raw.get("WorkplaceType")).lower(),
                expired=end is not None and end < moment,
            )
        )
    retained = frozenset(key for key in listed if key in known)
    return CareerSiteFetch(tuple(postings), retained, outside)


map_oracle_site = map_site


class OracleBoardAdapter(BoardAdapter):
    def __init__(self, mapping: BoardMapping) -> None:
        super().__init__(ORACLE_SOURCE_KEY, mapping)
