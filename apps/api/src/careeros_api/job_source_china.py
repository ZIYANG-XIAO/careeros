"""Large Chinese employers' own career sites (China market).

Each employer runs its own site with its own JSON listing API, so each has a
small reader here; mapping, robots.txt checks, and closing rules are shared.
Every reader first checks the site's ``robots.txt`` (RFC 9309) and reads only
paths it allows. Only postings in mainland China (``JobCountry.CN``) are kept;
Hong Kong, Macau, Taiwan, and overseas postings are skipped. See
``docs/JOB_SOURCE_DECISION.md``.

- **Tencent** — ``/tencentcareer/api/post/Query`` (``area=cn``), plus
  ``ByPostId`` for each new posting's requirements. The listing is complete,
  so absence closes.
- **Feishu-hosted portals** — ByteDance (jobs.bytedance.com) and every
  Feishu Recruiting tenant (``{tenant}.jobs.feishu.cn``) share one API: a CSRF
  token, then ``/api/v1/search/job/posts`` for the portal path named in the
  seed's ``site_url``. One query is capped at 10,000 results, so a larger
  portal is read one mainland city at a time; cities come from the portal's
  own filter and location-tree endpoints. Adding a tenant is a seed entry.
- **Meituan** — ``/api/official/job/getJobList``.
- **NetEase** — ``/api/hr163/position/queryPage``.

Baidu's listing API answers "no-auth / illegal-visit" to anonymous requests,
and Kuaishou's ``robots.txt`` disallows everything, so neither is read.
"""

import asyncio
import html
import re
from collections.abc import Awaitable, Callable, Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta, timezone
from typing import Any
from urllib.parse import urlsplit

import httpx

from careeros_api.china_places import is_mainland_place
from careeros_api.job_source_boards import (
    STALE_AFTER,
    USER_AGENT,
    BoardAdapter,
    BoardFetchError,
    BoardMapping,
    NormalizedJobCandidate,
    Robots,
    SourceBoard,
    build_candidate,
    is_standing_interest_posting,
    load_robots,
    posted_moment,
    text_value,
)
from careeros_api.models import JobCountry, JobEmploymentType, JobMarket, JobWorkplaceType

CHINA_SITE_SOURCE_KEY = "careersite-cn"
PAUSE_BETWEEN_REQUESTS_SECONDS = 1.0
RETRY_PAUSE_SECONDS = 3.0
MAX_NEW_PAGES_PER_RUN = 3000
MAX_DESCRIPTION = 100_000
CHINA = (JobMarket.CHINA, JobCountry.CN)


@dataclass(frozen=True)
class ChinaPosting:
    """One employer posting, already reduced to what the catalog needs."""

    external_id: str
    title: str
    places: tuple[str, ...]  # the posting's city names, as the site gives them
    description: str  # plain text
    url: str
    posted: datetime | None
    employment: JobEmploymentType
    # When the employer last updated or refreshed the posting, for sites that
    # give no first-publish time.
    refreshed: datetime | None = None


@dataclass(frozen=True)
class ChinaSiteFetch:
    postings: tuple[ChinaPosting, ...]
    retained: frozenset[str] = frozenset()
    # Postings the site itself placed outside mainland China before mapping.
    skipped_outside_market: int = 0
    # Postings the reader already recognized as not current openings.
    skipped_not_opening: int = 0


@dataclass(frozen=True)
class _Limits:
    pause: float
    max_new_pages: int


def _headers(extra: Mapping[str, str] | None = None) -> dict[str, str]:
    return {"User-Agent": USER_AGENT, "Accept": "application/json", **(extra or {})}


async def _request_json(
    client: httpx.AsyncClient,
    board: SourceBoard,
    method: str,
    url: str,
    *,
    params: Mapping[str, Any] | None = None,
    body: Any = None,
    headers: Mapping[str, str] | None = None,
) -> Any:
    # One retry after a network error: a single timeout among a portal's
    # hundred-odd requests would otherwise fail the whole board for the day.
    for attempt in range(2):
        try:
            response = await client.request(
                method,
                url,
                params=dict(params) if params else None,
                json=body,
                headers=_headers(headers),
                follow_redirects=True,
            )
            break
        except httpx.HTTPError as error:
            if attempt == 1:
                raise BoardFetchError(f"{board.token}: {type(error).__name__}") from error
            await asyncio.sleep(RETRY_PAUSE_SECONDS)
    if response.status_code != 200:
        raise BoardFetchError(f"{board.token}: HTTP {response.status_code}")
    try:
        return response.json()
    except ValueError as error:
        raise BoardFetchError(f"{board.token}: invalid JSON") from error


def _require(robots: Robots, board: SourceBoard, *urls: str) -> None:
    for url in urls:
        if not robots.allows(url):
            raise BoardFetchError(f"{board.token}: robots.txt disallows {url}")


# A first line that is already a section heading: "岗位职责:", "【任职资格】", …
_OWN_HEADING = re.compile(
    r"^[【\[]?[^\n]{0,10}(?:职责|要求|资格|描述|说明|愿景)[^\n]{0,4}[】\]]?[:：]?$"
)


def plain_text(*sections: tuple[str, Any]) -> str:
    """Join titled plain-text sections, normalizing line breaks and blank runs.

    A section whose text already opens with its own heading keeps it instead
    of getting a second one.
    """
    parts: list[str] = []
    for heading, value in sections:
        body = html.unescape(text_value(value)).replace("\r\n", "\n").replace("\r", "\n")
        body = re.sub(r"[ \t\u3000\xa0]+\n", "\n", body)
        body = re.sub(r"\n{3,}", "\n\n", body).strip()
        if not body:
            continue
        first_line = body.split("\n", 1)[0].strip()
        if heading and not _OWN_HEADING.match(first_line):
            body = f"{heading}\n{body}"
        parts.append(body)
    return "\n\n".join(parts)[:MAX_DESCRIPTION]


def employment_from_chinese_title(title: str) -> JobEmploymentType:
    return JobEmploymentType.INTERNSHIP if "实习" in title else JobEmploymentType.UNKNOWN


# Postings that collect résumés rather than fill an open role: talent pools,
# résumé drop boxes, and referral-only placeholders ("内推专用岗位").
_NOT_AN_OPENING = re.compile(
    r"人才库|人才池|人才储备|储备人才|人才交流|内推专用|简历投递|投递入口|自荐|意向岗|岗位池|"
    r"岗位专项|不限岗位"
)
# Agency staffing (派遣) and outsourcing (外包) roles are real openings but not
# direct employment by the listed employer.
_AGENCY_STAFFED = re.compile(r"派遣编制|[（(【\[]\s*(?:派遣|外包)|网易外包|劳务派遣")


def is_not_an_opening(title: str) -> bool:
    return bool(_NOT_AN_OPENING.search(title)) or is_standing_interest_posting(title)


def is_unwanted(title: str, refreshed: datetime | None, observed_at: datetime) -> bool:
    """Not a current opening: a placeholder, or not updated for longer than the
    shared staleness window (an abandoned listing, like a posting first
    published that long ago)."""
    abandoned = refreshed is not None and refreshed < observed_at - STALE_AFTER
    return abandoned or is_not_an_opening(title)


# Real postings state duties and requirements; a description shorter than this
# ("核心人才交流", "服务器开发/客户端开发等") marks a résumé channel, not a role.
MIN_DESCRIPTION_CHARS = 50


def employment_for(posting: "ChinaPosting") -> JobEmploymentType:
    """The source's employment type, except agency-staffed roles are CONTRACT."""
    if _AGENCY_STAFFED.search(posting.title):
        return JobEmploymentType.CONTRACT
    return posting.employment


# --- Tencent ----------------------------------------------------------------

_BEIJING = timezone(timedelta(hours=8))
_CHINESE_DATE = re.compile(r"^(\d{4})年(\d{1,2})月(\d{1,2})日$")


def _tencent_date(value: Any) -> datetime | None:
    """Tencent's "2026年10月12日" (Beijing time) as an aware moment."""
    match = _CHINESE_DATE.match(text_value(value))
    if match is None:
        return None
    try:
        year, month, day = (int(part) for part in match.groups())
        return datetime(year, month, day, tzinfo=_BEIJING)
    except ValueError:
        return None


TENCENT = "https://careers.tencent.com"
TENCENT_PAGE = 200


async def fetch_tencent(
    client: httpx.AsyncClient, board: SourceBoard, known: Mapping[str, str], limits: _Limits
) -> ChinaSiteFetch:
    listing = f"{TENCENT}/tencentcareer/api/post/Query"
    detail = f"{TENCENT}/tencentcareer/api/post/ByPostId"
    robots = await load_robots(client, board, TENCENT)
    _require(robots, board, listing, detail)
    rows: dict[str, dict[str, Any]] = {}
    page_index, total = 1, None
    # Paged by count, not rows held: the listing repeats a few postings across
    # pages, and a page past the end answers ``Posts: null``.
    while total is None or (page_index - 1) * TENCENT_PAGE < total:
        await asyncio.sleep(limits.pause)
        payload = await _request_json(
            client,
            board,
            "GET",
            listing,
            params={
                "pageIndex": page_index,
                "pageSize": TENCENT_PAGE,
                "language": "zh-cn",
                "area": "cn",
            },
        )
        data = payload.get("Data") if isinstance(payload, dict) else None
        if not isinstance(data, dict):
            raise BoardFetchError(f"{board.token}: unexpected Tencent payload")
        posts = data.get("Posts")
        if posts is None and total is not None:
            break
        if not isinstance(posts, list):
            raise BoardFetchError(f"{board.token}: unexpected Tencent payload")
        total = int(data.get("Count") or 0)
        if not posts:
            break
        for raw in posts:
            post_id = text_value(raw.get("PostId")) if isinstance(raw, dict) else ""
            if post_id:
                rows[post_id] = raw
        page_index += 1

    postings: list[ChinaPosting] = []
    retained: set[str] = set()
    outside = fetched_details = not_opening = 0
    moment = datetime.now(UTC)
    for post_id, raw in rows.items():
        external_id = f"{board.external_id_prefix}{post_id}"
        city = text_value(raw.get("LocationName"))
        if text_value(raw.get("CountryName")) != "中国" or not is_mainland_place(city):
            outside += 1
            continue
        if raw.get("IsValid") is False:
            continue
        title = text_value(raw.get("RecruitPostName"))
        refreshed = _tencent_date(raw.get("LastUpdateTime"))
        # Checked before retaining, so a known posting that went stale or turns
        # out to be a placeholder is closed rather than kept open unread.
        if is_unwanted(title, refreshed, moment):
            not_opening += 1
            continue
        if external_id in known:
            retained.add(external_id)
            continue
        if fetched_details >= limits.max_new_pages:
            continue  # picked up on a later run
        await asyncio.sleep(limits.pause)
        fetched_details += 1
        try:
            full = await _request_json(
                client, board, "GET", detail, params={"postId": post_id, "language": "zh-cn"}
            )
        except BoardFetchError:
            full = None
        info = full.get("Data") if isinstance(full, dict) else None
        info = info if isinstance(info, dict) else {}
        postings.append(
            ChinaPosting(
                external_id=external_id,
                title=title,
                places=(city,),
                description=plain_text(
                    ("工作职责", info.get("Responsibility") or raw.get("Responsibility")),
                    ("工作要求", info.get("Requirement")),
                ),
                url=f"{TENCENT}/jobdesc.html?postId={post_id}",
                posted=None,  # Tencent gives only a last-update date
                refreshed=refreshed,
                employment=employment_from_chinese_title(title),
            )
        )
    return ChinaSiteFetch(tuple(postings), frozenset(retained), outside, not_opening)


# --- Feishu-hosted portals (ByteDance and Feishu Recruiting tenants) ----------

FEISHU_QUERY_CAP = 10_000
FEISHU_PAGE = 100
_MAINLAND_ROOT = "CN_1"
# Feishu Recruiting serves ByteDance's own site and each tenant's
# ``{tenant}.jobs.feishu.cn`` site with the same API; nothing else is read.
_FEISHU_HOST = re.compile(r"^(?:jobs\.bytedance\.com|[a-z0-9-]+\.jobs\.feishu\.cn)$")
_PORTAL_PATH = re.compile(r"^[a-z0-9_-]{1,40}$")


@dataclass(frozen=True)
class _Portal:
    origin: str  # https://host
    path: str  # the portal ("website") path, e.g. "society" or "index"


def _feishu_portal(board: SourceBoard) -> _Portal:
    parts = urlsplit(board.site_url or "")
    path = parts.path.strip("/")
    if parts.scheme != "https" or not _FEISHU_HOST.match(parts.netloc):
        raise BoardFetchError(f"{board.token}: not a Feishu-hosted career site")
    if not _PORTAL_PATH.match(path):
        raise BoardFetchError(f"{board.token}: site_url needs one portal path segment")
    return _Portal(f"https://{parts.netloc}", path)


def _mainland_city_codes(tree: Any) -> set[str]:
    """City codes under the portal's 中国大陆 location node."""
    data = tree.get("data") if isinstance(tree, dict) else None
    roots = data.get("location_node_list") if isinstance(data, dict) else None
    if not isinstance(roots, list):
        raise BoardFetchError("unexpected location tree")
    codes: set[str] = set()
    stack = [
        node
        for node in roots
        if isinstance(node, dict) and (node.get("location") or {}).get("code") == _MAINLAND_ROOT
    ]
    while stack:
        node = stack.pop()
        code = text_value((node.get("location") or {}).get("code"))
        if code.startswith("CT_"):
            codes.add(code)
        stack.extend(child for child in node.get("children") or [] if isinstance(child, dict))
    return codes


def _feishu_employment(raw: dict[str, Any], title: str) -> JobEmploymentType:
    kind = raw.get("recruit_type") or {}
    parent = text_value((kind.get("parent") or {}).get("name"))
    name = text_value(kind.get("name"))
    if "实习" in name or "实习" in parent:
        return JobEmploymentType.INTERNSHIP
    # 社招 (experienced hire) as 正式 (regular) or 全职 (full-time) is a
    # full-time position.
    if parent == "社招" and name in ("正式", "全职"):
        return JobEmploymentType.FULL_TIME
    return employment_from_chinese_title(title)


def _feishu_posting(
    board: SourceBoard, portal: _Portal, raw: dict[str, Any], moment: datetime
) -> ChinaPosting | None:
    job_id = text_value(raw.get("id"))
    if not job_id.isdigit():
        return None
    places: list[str] = []
    for city in [raw.get("city_info"), *(raw.get("city_list") or [])]:
        name = text_value((city or {}).get("name")) if isinstance(city, dict) else ""
        if name and name not in places:
            places.append(name)
    title = text_value(raw.get("title"))
    return ChinaPosting(
        external_id=f"{board.external_id_prefix}{job_id}",
        title=title,
        places=tuple(places),
        description=plain_text(
            ("职位描述", raw.get("description")), ("职位要求", raw.get("requirement"))
        ),
        url=f"{portal.origin}/{portal.path}/position/{job_id}/detail",
        posted=posted_moment(raw.get("publish_time"), moment),
        employment=_feishu_employment(raw, title),
    )


async def fetch_feishu(
    client: httpx.AsyncClient, board: SourceBoard, known: Mapping[str, str], limits: _Limits
) -> ChinaSiteFetch:
    """One Feishu-hosted portal. Under the 10,000-result cap it is read in one
    pass; above it, one mainland city at a time."""
    portal = _feishu_portal(board)
    api = f"{portal.origin}/api/v1"
    search = f"{api}/search/job/posts"
    robots = await load_robots(client, board, portal.origin)
    _require(robots, board, f"{api}/csrf/token", search, f"{portal.origin}/{portal.path}/position")
    token = await _request_json(
        client, board, "POST", f"{api}/csrf/token", body={"portal_entrance": 1}
    )
    csrf = text_value((token.get("data") or {}).get("token")) if isinstance(token, dict) else ""
    if not csrf:
        raise BoardFetchError(f"{board.token}: no CSRF token")
    headers = {
        "x-csrf-token": csrf,
        "website-path": portal.path,
        "Portal-Channel": "saas-career",
        "Portal-Platform": "pc",
        "Accept-Language": "zh-CN",
    }
    moment = datetime.now(UTC)
    postings: dict[str, ChinaPosting] = {}

    async def read(cities: list[str]) -> bool:
        """Page one query; False when it hit the result cap."""
        offset, total = 0, None
        while total is None or offset < min(total, FEISHU_QUERY_CAP):
            await asyncio.sleep(limits.pause)
            payload = await _request_json(
                client,
                board,
                "POST",
                search,
                headers=headers,
                body={
                    "keyword": "",
                    "limit": FEISHU_PAGE,
                    "offset": offset,
                    "job_category_id_list": [],
                    "location_code_list": cities,
                    "subject_id_list": [],
                    "recruitment_id_list": [],
                    "portal_type": 2,
                    "job_function_id_list": [],
                    "portal_entrance": 1,
                },
            )
            data = payload.get("data") if isinstance(payload, dict) else None
            jobs = data.get("job_post_list") if isinstance(data, dict) else None
            if not isinstance(data, dict) or not isinstance(jobs, list):
                raise BoardFetchError(f"{board.token}: unexpected Feishu payload")
            total = int(data.get("count") or 0)
            if not jobs:
                break
            for raw in jobs:
                posting = (
                    _feishu_posting(board, portal, raw, moment) if isinstance(raw, dict) else None
                )
                if posting is not None:
                    postings[posting.external_id] = posting
            offset += len(jobs)
        return (total or 0) < FEISHU_QUERY_CAP

    complete = await read([])
    if not complete:
        postings.clear()
        await asyncio.sleep(limits.pause)
        filters = await _request_json(
            client, board, "GET", f"{api}/config/job/filters/2", headers=headers
        )
        await asyncio.sleep(limits.pause)
        try:
            mainland = _mainland_city_codes(
                await _request_json(
                    client, board, "GET", f"{api}/config/location/nodes/", headers=headers
                )
            )
        except BoardFetchError as error:
            raise BoardFetchError(f"{board.token}: {error}") from error
        listed = (filters.get("data") or {}).get("city_list") if isinstance(filters, dict) else None
        if not isinstance(listed, list):
            raise BoardFetchError(f"{board.token}: unexpected filter payload")
        cities = [
            text_value(city.get("code"))
            for city in listed
            if isinstance(city, dict) and text_value(city.get("code")) in mainland
        ]
        if not cities:
            raise BoardFetchError(f"{board.token}: no mainland cities listed")
        complete = True
        for city in cities:
            complete = await read([city]) and complete
    # A capped query may hide postings; keep known ones open rather than guess.
    retained = frozenset() if complete else frozenset(key for key in known if key not in postings)
    return ChinaSiteFetch(tuple(postings.values()), retained)


# --- Meituan ----------------------------------------------------------------

MEITUAN = "https://zhaopin.meituan.com"
MEITUAN_PAGE = 50
# jobType 2 is Meituan's internship channel; 1 (campus) and 3 (experienced)
# carry no explicit employment type, so the title decides.
_MEITUAN_INTERNSHIP = "2"


def _meituan_posting(
    board: SourceBoard, raw: dict[str, Any], moment: datetime
) -> ChinaPosting | None:
    job_id = text_value(raw.get("jobUnionId"))
    if not job_id.isdigit():
        return None
    title = text_value(raw.get("name"))
    places = tuple(
        name
        for name in (text_value(city.get("name")) for city in raw.get("cityList") or [])
        if name
    )
    employment = (
        JobEmploymentType.INTERNSHIP
        if text_value(raw.get("jobType")) == _MEITUAN_INTERNSHIP
        else employment_from_chinese_title(title)
    )
    return ChinaPosting(
        external_id=f"{board.external_id_prefix}{job_id}",
        title=title,
        places=places,
        description=plain_text(
            ("岗位职责", raw.get("jobDuty")),
            ("岗位要求", raw.get("jobRequirement")),
            ("加分项", raw.get("precedence")),
        ),
        url=f"{MEITUAN}/web/position/detail?jobUnionId={job_id}",
        posted=posted_moment(raw.get("firstPostTime"), moment),
        refreshed=posted_moment(raw.get("refreshTime"), moment),
        employment=employment,
    )


async def fetch_meituan(
    client: httpx.AsyncClient, board: SourceBoard, known: Mapping[str, str], limits: _Limits
) -> ChinaSiteFetch:
    listing = f"{MEITUAN}/api/official/job/getJobList"
    robots = await load_robots(client, board, MEITUAN)
    _require(robots, board, listing, f"{MEITUAN}/web/position/detail")
    moment = datetime.now(UTC)
    postings: dict[str, ChinaPosting] = {}
    page_no, pages = 1, None
    while pages is None or page_no <= pages:
        await asyncio.sleep(limits.pause)
        payload = await _request_json(
            client,
            board,
            "POST",
            listing,
            body={
                "page": {"pageNo": page_no, "pageSize": MEITUAN_PAGE},
                "jobShareType": "1",
                "keywords": "",
                "cityList": [],
                "department": [],
                "jfJgList": [],
                "jobType": [],
                "typeCode": [],
                "specialCode": [],
            },
        )
        data = payload.get("data") if isinstance(payload, dict) else None
        jobs = data.get("list") if isinstance(data, dict) else None
        if not isinstance(data, dict) or not isinstance(jobs, list):
            raise BoardFetchError(f"{board.token}: unexpected Meituan payload")
        pages = int((data.get("page") or {}).get("totalPage") or 0)
        if not jobs:
            break
        for raw in jobs:
            posting = _meituan_posting(board, raw, moment) if isinstance(raw, dict) else None
            if posting is not None:
                postings[posting.external_id] = posting
        page_no += 1
    return ChinaSiteFetch(tuple(postings.values()))


# --- NetEase ----------------------------------------------------------------

NETEASE = "https://hr.163.com"
NETEASE_PAGE = 100
_NETEASE_INTERNSHIP = "1"  # workType 1 is NetEase's internship listing


def _netease_posting(board: SourceBoard, raw: dict[str, Any]) -> ChinaPosting | None:
    job_id = raw.get("id")
    if isinstance(job_id, bool) or not isinstance(job_id, int):
        return None
    title = text_value(raw.get("name"))
    places = tuple(text_value(name) for name in raw.get("workPlaceNameList") or [] if name)
    employment = (
        JobEmploymentType.INTERNSHIP
        if text_value(raw.get("workType")) == _NETEASE_INTERNSHIP
        else employment_from_chinese_title(title)
    )
    return ChinaPosting(
        external_id=f"{board.external_id_prefix}{job_id}",
        title=title,
        places=places,
        description=plain_text(
            ("职位描述", raw.get("description")), ("职位要求", raw.get("requirement"))
        ),
        url=f"{NETEASE}/job-detail.html?id={job_id}",
        posted=None,  # NetEase gives only an update time
        refreshed=posted_moment(raw.get("updateTime"), datetime.now(UTC)),
        employment=employment,
    )


async def fetch_netease(
    client: httpx.AsyncClient, board: SourceBoard, known: Mapping[str, str], limits: _Limits
) -> ChinaSiteFetch:
    listing = f"{NETEASE}/api/hr163/position/queryPage"
    robots = await load_robots(client, board, NETEASE)
    _require(robots, board, listing, f"{NETEASE}/job-detail.html")
    postings: dict[str, ChinaPosting] = {}
    page, pages = 1, None
    while pages is None or page <= pages:
        await asyncio.sleep(limits.pause)
        payload = await _request_json(
            client,
            board,
            "POST",
            listing,
            body={"currentPage": page, "pageSize": NETEASE_PAGE},
        )
        data = payload.get("data") if isinstance(payload, dict) else None
        jobs = data.get("list") if isinstance(data, dict) else None
        if not isinstance(data, dict) or not isinstance(jobs, list):
            raise BoardFetchError(f"{board.token}: unexpected NetEase payload")
        pages = int(data.get("pages") or 0)
        if not jobs:
            break
        for raw in jobs:
            posting = _netease_posting(board, raw) if isinstance(raw, dict) else None
            if posting is not None:
                postings[posting.external_id] = posting
        page += 1
    return ChinaSiteFetch(tuple(postings.values()))


# --- dispatch and mapping -----------------------------------------------------

Reader = Callable[
    [httpx.AsyncClient, SourceBoard, Mapping[str, str], _Limits], Awaitable[ChinaSiteFetch]
]
READERS: dict[str, Reader] = {
    "tencent": fetch_tencent,
    "meituan": fetch_meituan,
    "netease": fetch_netease,
}


async def fetch_site(
    client: httpx.AsyncClient,
    board: SourceBoard,
    known: Mapping[str, str],
    *,
    pause: float = PAUSE_BETWEEN_REQUESTS_SECONDS,
    max_new_pages: int = MAX_NEW_PAGES_PER_RUN,
) -> ChinaSiteFetch:
    reader = READERS.get(board.token) or (fetch_feishu if board.site_url else None)
    if reader is None:
        raise BoardFetchError(f"{board.token}: no China career-site reader for this employer")
    return await reader(client, board, known, _Limits(pause, max_new_pages))


def map_china_site(
    payload: Any, board: SourceBoard, observed_at: datetime | None = None
) -> BoardMapping:
    if not isinstance(payload, ChinaSiteFetch):
        raise BoardFetchError("Unexpected China career-site payload")
    moment = observed_at or datetime.now(UTC)
    candidates: list[NormalizedJobCandidate] = []
    outside = payload.skipped_outside_market
    invalid = 0
    not_opening = payload.skipped_not_opening
    for posting in payload.postings:
        if (
            is_unwanted(posting.title, posting.refreshed, moment)
            or len(posting.description) < MIN_DESCRIPTION_CHARS
        ):
            not_opening += 1
            continue
        # Kept when any of its cities is in mainland China, like a North
        # American posting that also lists a city elsewhere.
        if not any(is_mainland_place(place) for place in posting.places):
            outside += 1
            continue
        candidate = build_candidate(
            external_id=posting.external_id,
            board=board,
            title=posting.title,
            location=" · ".join(posting.places),
            description=posting.description,
            posting_url=posting.url,
            application_url=posting.url,
            placement=CHINA,
            workplace=JobWorkplaceType.UNKNOWN,
            employment=employment_for(posting),
            observed_at=moment,
            posted_at=posting.posted,
        )
        if candidate is None:
            invalid += 1
        else:
            candidates.append(candidate)
    return BoardMapping(
        tuple(candidates),
        len(payload.postings)
        + len(payload.retained)
        + payload.skipped_outside_market
        + payload.skipped_not_opening,
        outside,
        invalid,
        not_opening,
        retained_external_ids=payload.retained,
    )


class ChinaSiteBoardAdapter(BoardAdapter):
    def __init__(self, mapping: BoardMapping) -> None:
        super().__init__(CHINA_SITE_SOURCE_KEY, mapping)
