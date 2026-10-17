"""Chinese employers' career-site readers, offline through a mock transport."""

import json
from collections.abc import Callable
from datetime import UTC, datetime
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from careeros_api.china_places import is_mainland_place
from careeros_api.job_source_boards import BoardFetchError, SourceBoard
from careeros_api.job_source_china import (
    CHINA_SITE_SOURCE_KEY,
    FEISHU_QUERY_CAP,
    READERS,
    ChinaPosting,
    ChinaSiteFetch,
    fetch_site,
    map_china_site,
    plain_text,
)
from careeros_api.models import JobCountry, JobEmploymentType, JobMarket

MOMENT = datetime(2026, 10, 12, tzinfo=UTC)
DUTY = "负责推荐系统的架构设计与开发，持续优化线上服务的性能和稳定性。"
NEED = "本科及以上学历，三年以上后端开发经验，熟悉分布式系统。"


async def run(
    token: str,
    handler: Callable[[httpx.Request], httpx.Response],
    known: dict[str, str] | None = None,
    max_new_pages: int = 3000,
    site_url: str | None = None,
) -> tuple[ChinaSiteFetch, SourceBoard]:
    board = SourceBoard(token, token.title(), site_url)
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        fetched = await fetch_site(client, board, known or {}, pause=0, max_new_pages=max_new_pages)
    return fetched, board


def ids(fetched: ChinaSiteFetch, board: SourceBoard) -> set[str | None]:
    return {c.external_job_id for c in map_china_site(fetched, board, MOMENT).candidates}


def test_mainland_places_exclude_hong_kong_and_overseas() -> None:
    for name in ("北京", "北京市", "深圳", "内蒙古自治区", "广西壮族自治区"):
        assert is_mainland_place(name), name
    for name in ("中国香港", "香港特别行政区", "新加坡", "迪拜", "科威特城", "国外", ""):
        assert not is_mainland_place(name), name


# --- Tencent ----------------------------------------------------------------


def tencent_post(post_id: str, city: str = "深圳", country: str = "中国") -> dict[str, object]:
    return {
        "PostId": post_id,
        "RecruitPostName": "后台开发工程师",
        "CountryName": country,
        "LocationName": city,
        "Responsibility": DUTY,
        "IsValid": True,
    }


def tencent_handler(
    posts: list[dict[str, object]], details: list[str]
) -> Callable[[httpx.Request], httpx.Response]:
    def handle(request: httpx.Request) -> httpx.Response:
        url = urlsplit(str(request.url))
        query = parse_qs(url.query)
        if url.path == "/robots.txt":
            return httpx.Response(404)
        if url.path.endswith("/ByPostId"):
            details.append(query["postId"][0])
            return httpx.Response(
                200, json={"Code": 200, "Data": {"Responsibility": DUTY, "Requirement": NEED}}
            )
        size = int(query["pageSize"][0])
        start = (int(query["pageIndex"][0]) - 1) * size
        page = posts[start : start + size]
        data = {"Count": len(posts), "Posts": page} if page else {"Count": 0, "Posts": None}
        return httpx.Response(200, json={"Code": 200, "Data": data})

    return handle


@pytest.mark.asyncio
async def test_tencent_keeps_mainland_and_reads_details_for_new_postings_only() -> None:
    posts = [tencent_post(str(i)) for i in range(250)]
    posts += [tencent_post("hk", "中国香港"), tencent_post("sg", "新加坡", "新加坡")]
    details: list[str] = []
    known = {"tencent:0": "https://careers.tencent.com/jobdesc.html?postId=0"}

    fetched, board = await run("tencent", tencent_handler(posts, details), known)
    mapping = map_china_site(fetched, board, MOMENT)

    assert len(mapping.candidates) == 249  # paged past 200; one already known
    assert "0" not in details and len(details) == 249
    assert mapping.retained_external_ids == {"tencent:0"}
    assert mapping.skipped_outside_market == 2
    job = mapping.candidates[0]
    assert (job.market, job.country_code) == (JobMarket.CHINA, JobCountry.CN)
    assert "工作要求" in job.description and NEED in job.description
    assert str(job.source_url).startswith("https://careers.tencent.com/jobdesc.html?postId=")


@pytest.mark.asyncio
async def test_tencent_defers_postings_beyond_the_detail_budget() -> None:
    posts = [tencent_post(str(i)) for i in range(5)]
    fetched, board = await run("tencent", tencent_handler(posts, []), max_new_pages=2)
    # The rest are neither ingested nor closed; a later run picks them up.
    assert ids(fetched, board) == {"tencent:0", "tencent:1"}


# --- Feishu-hosted portals ------------------------------------------------------

BYTEDANCE_SITE = "https://jobs.bytedance.com/society"


def feishu_job(job_id: str, city: str = "北京", kind: str = "正式") -> dict[str, object]:
    return {
        "id": job_id,
        "title": "推荐算法工程师",
        "description": DUTY,
        "requirement": NEED,
        "city_info": {"code": "CT_11", "name": city},
        "city_list": [{"code": "CT_11", "name": city}],
        "recruit_type": {"name": kind, "parent": {"name": "社招"}},
        "publish_time": 1791535405262,
    }


LOCATION_TREE = {
    "code": 0,
    "data": {
        "location_node_list": [
            {
                "location": {"code": "CN_1", "name": "中国大陆"},
                "children": [
                    {
                        "location": {"code": "ST_1", "name": "北京"},
                        "children": [{"location": {"code": "CT_11", "name": "北京"}}],
                    },
                    {
                        "location": {"code": "ST_2", "name": "上海"},
                        "children": [{"location": {"code": "CT_125", "name": "上海"}}],
                    },
                ],
            },
            {
                "location": {"code": "CN_163", "name": "新加坡"},
                "children": [{"location": {"code": "CT_163", "name": "新加坡"}}],
            },
        ]
    },
}


def feishu_handler(
    by_city: dict[str, list[dict[str, object]]],
    searched: list[str],
    count: Callable[[str, int], int] = lambda city, n: n,
    portal: str = "society",
) -> Callable[[httpx.Request], httpx.Response]:
    """Queries without a city see every listed posting under the key ``""``."""

    def handle(request: httpx.Request) -> httpx.Response:
        path = urlsplit(str(request.url)).path
        if path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /referral\n")
        if path.endswith("/csrf/token"):
            return httpx.Response(200, json={"code": 0, "data": {"token": "t"}})
        assert request.headers["website-path"] == portal
        if path.endswith("/config/job/filters/2"):
            cities = [{"code": code} for code in ("CT_11", "CT_125", "CT_163")]
            return httpx.Response(200, json={"code": 0, "data": {"city_list": cities}})
        if path.endswith("/config/location/nodes/"):
            return httpx.Response(200, json=LOCATION_TREE)
        assert request.headers["x-csrf-token"] == "t"
        body = json.loads(request.content)
        city = (body["location_code_list"] or [""])[0]
        searched.append(city)
        jobs = by_city.get(city, [])
        page = jobs[body["offset"] : body["offset"] + body["limit"]]
        return httpx.Response(
            200,
            json={"code": 0, "data": {"count": count(city, len(jobs)), "job_post_list": page}},
        )

    return handle


@pytest.mark.asyncio
async def test_feishu_tenant_under_the_cap_is_read_in_one_pass() -> None:
    jobs = [feishu_job(str(i), kind="全职") for i in range(130)] + [feishu_job("999", "新加坡")]
    searched: list[str] = []
    fetched, board = await run(
        "nio",
        feishu_handler({"": jobs}, searched, portal="index"),
        site_url="https://nio.jobs.feishu.cn/index",
    )
    mapping = map_china_site(fetched, board, MOMENT)

    assert set(searched) == {""}  # no per-city queries
    assert len(mapping.candidates) == 130 and mapping.skipped_outside_market == 1
    job = mapping.candidates[0]
    assert job.employment_type == JobEmploymentType.FULL_TIME  # 社招 · 全职
    assert str(job.source_url) == "https://nio.jobs.feishu.cn/index/position/0/detail"


@pytest.mark.asyncio
async def test_feishu_portal_over_the_cap_is_read_by_mainland_city() -> None:
    beijing = [feishu_job(str(i)) for i in range(130)]
    shanghai = [feishu_job("1", "上海"), feishu_job("900", "上海", "实习")]
    searched: list[str] = []
    handler = feishu_handler(
        {"": beijing, "CT_11": beijing, "CT_125": shanghai},
        searched,
        count=lambda city, n: FEISHU_QUERY_CAP if city == "" else n,
    )

    fetched, board = await run("bytedance", handler, site_url=BYTEDANCE_SITE)
    mapping = map_china_site(fetched, board, MOMENT)

    assert "CT_163" not in searched  # Singapore is never queried
    assert len(mapping.candidates) == 131  # a posting listed in two cities counts once
    assert mapping.retained_external_ids == frozenset()  # every city was complete
    job = next(c for c in mapping.candidates if c.external_job_id == "bytedance:0")
    assert job.employment_type == JobEmploymentType.FULL_TIME
    assert job.posted_at is not None
    assert str(job.source_url) == "https://jobs.bytedance.com/society/position/0/detail"
    intern = next(c for c in mapping.candidates if c.external_job_id == "bytedance:900")
    assert intern.employment_type == JobEmploymentType.INTERNSHIP


@pytest.mark.asyncio
async def test_feishu_capped_city_keeps_known_postings_open() -> None:
    handler = feishu_handler(
        {"CT_11": [feishu_job("1")]},
        [],
        count=lambda city, n: FEISHU_QUERY_CAP if city in ("", "CT_11") else n,
    )
    known = {"bytedance:77": "https://jobs.bytedance.com/society/position/77/detail"}
    fetched, board = await run("bytedance", handler, known, site_url=BYTEDANCE_SITE)
    assert map_china_site(fetched, board, MOMENT).retained_external_ids == {"bytedance:77"}


@pytest.mark.asyncio
async def test_feishu_reader_refuses_sites_outside_feishu() -> None:
    requested: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requested.append(str(request.url))
        return httpx.Response(404)

    with pytest.raises(BoardFetchError, match="not a Feishu-hosted career site"):
        await run("evil", handle, site_url="https://example.com/index")
    assert requested == []


# --- Meituan and NetEase ----------------------------------------------------------


def meituan_job(job_id: str, cities: list[str], job_type: str = "3") -> dict[str, object]:
    return {
        "jobUnionId": job_id,
        "name": "搜索产品经理",
        "jobType": job_type,
        "cityList": [{"name": city} for city in cities],
        "jobDuty": DUTY,
        "jobRequirement": NEED,
    }


@pytest.mark.asyncio
async def test_meituan_skips_overseas_and_hong_kong_and_maps_internships() -> None:
    jobs = [
        meituan_job("1", ["北京市", "上海市"]),
        meituan_job("2", ["北京市"], job_type="2"),
        meituan_job("3", ["香港特别行政区"]),
        meituan_job("4", ["利雅得", "迪拜"]),
        meituan_job("5", ["迪拜", "深圳市"]),
    ]

    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(200, text="<!doctype html><html></html>")
        page = json.loads(request.content)["page"]
        start = (page["pageNo"] - 1) * page["pageSize"]
        return httpx.Response(
            200,
            json={
                "data": {
                    "list": jobs[start : start + page["pageSize"]],
                    "page": {"totalPage": 1, "totalCount": len(jobs)},
                }
            },
        )

    fetched, board = await run("meituan", handle)
    mapping = map_china_site(fetched, board, MOMENT)

    assert {c.external_job_id for c in mapping.candidates} == {
        "meituan:1",
        "meituan:2",
        "meituan:5",
    }
    assert mapping.skipped_outside_market == 2
    by_id = {c.external_job_id: c for c in mapping.candidates}
    assert by_id["meituan:2"].employment_type == JobEmploymentType.INTERNSHIP
    assert by_id["meituan:1"].employment_type == JobEmploymentType.UNKNOWN
    assert by_id["meituan:1"].location == "北京市 · 上海市"


@pytest.mark.asyncio
async def test_netease_pages_through_the_listing() -> None:
    jobs = [
        {
            "id": i,
            "name": "游戏策划",
            "workType": "1" if i == 0 else "0",
            "workPlaceNameList": ["英国"] if i == 1 else ["杭州市"],
            "description": DUTY,
            "requirement": NEED,
        }
        for i in range(150)
    ]

    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        body = json.loads(request.content)
        size = body["pageSize"]
        start = (body["currentPage"] - 1) * size
        return httpx.Response(
            200,
            json={
                "code": 200,
                "data": {"list": jobs[start : start + size], "pages": 2, "total": len(jobs)},
            },
        )

    fetched, board = await run("netease", handle)
    mapping = map_china_site(fetched, board, MOMENT)

    assert len(mapping.candidates) == 149
    assert "netease:1" not in {c.external_job_id for c in mapping.candidates}
    intern = next(c for c in mapping.candidates if c.external_job_id == "netease:0")
    assert intern.employment_type == JobEmploymentType.INTERNSHIP


# --- shared --------------------------------------------------------------------


@pytest.mark.asyncio
async def test_robots_disallow_fails_the_site_before_reading_jobs() -> None:
    requested: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requested.append(request.url.path)
        return httpx.Response(200, text="User-agent: *\nDisallow: /api\n")

    with pytest.raises(BoardFetchError, match="robots.txt disallows"):
        await run("netease", handle)
    assert requested == ["/robots.txt"]


@pytest.mark.asyncio
async def test_unknown_employer_is_rejected() -> None:
    with pytest.raises(BoardFetchError, match="no China career-site reader"):
        await run("baidu", lambda request: httpx.Response(404))


def test_seed_file_names_the_source_with_an_ingestible_key() -> None:
    seed = Path(__file__).resolve().parents[1] / "job_sources" / "careersite-cn_china.json"
    document = json.loads(seed.read_text(encoding="utf-8"))
    assert document["source_key"] == CHINA_SITE_SOURCE_KEY
    # ingest_job_source accepts letters, digits, and hyphens only.
    assert CHINA_SITE_SOURCE_KEY.replace("-", "").isalnum()
    for board in document["boards"]:
        assert board["token"] in READERS or board.get("site_url", "").startswith("https://")


def test_placeholder_postings_are_dropped_and_agency_roles_are_contract() -> None:
    def posting(external_id: str, title: str) -> ChinaPosting:
        return ChinaPosting(
            external_id=external_id,
            title=title,
            places=("杭州市",),
            description=f"{DUTY}\n{NEED}",
            url=f"https://hr.163.com/job-detail.html?id={external_id}",
            posted=None,
            employment=JobEmploymentType.UNKNOWN,
        )

    fetched = ChinaSiteFetch(
        (
            posting("1", "内推专用岗位（NEXUS）"),
            posting("2", "游戏策划人才库"),
            posting("3", "服务端开发（派遣）-广州/杭州"),
            posting("4", "【网易外包】网易游戏视频创意编导"),
            posting("5", "门店管理储备岗"),  # a management-trainee role, kept
            posting("6", "Global Mobility 全球派遣运营专员"),  # a role about postings abroad
        )
    )
    mapping = map_china_site(fetched, SourceBoard("netease", "网易"), MOMENT)

    by_id = {c.external_job_id: c.employment_type for c in mapping.candidates}
    assert mapping.skipped_not_opening == 2
    assert by_id == {
        "3": JobEmploymentType.CONTRACT,
        "4": JobEmploymentType.CONTRACT,
        "5": JobEmploymentType.UNKNOWN,
        "6": JobEmploymentType.UNKNOWN,
    }


@pytest.mark.asyncio
async def test_postings_not_updated_for_a_year_are_dropped() -> None:
    posts = [tencent_post("fresh"), tencent_post("old")]
    posts[0]["LastUpdateTime"] = "2026年10月1日"
    posts[1]["LastUpdateTime"] = "2025年9月30日"
    fetched, board = await run("tencent", tencent_handler(posts, []))
    mapping = map_china_site(fetched, board, MOMENT)
    assert {c.external_job_id for c in mapping.candidates} == {"tencent:fresh"}
    assert mapping.skipped_not_opening == 1


@pytest.mark.asyncio
async def test_known_tencent_posting_that_went_stale_is_not_kept_open() -> None:
    posts = [tencent_post("live"), tencent_post("stale"), tencent_post("pool")]
    posts[0]["LastUpdateTime"] = "2026年10月1日"
    posts[1]["LastUpdateTime"] = "2025年1月2日"
    posts[2]["RecruitPostName"] = "技术人才库"
    known = {f"tencent:{key}": "u" for key in ("live", "stale", "pool")}
    details: list[str] = []
    fetched, board = await run("tencent", tencent_handler(posts, details), known)
    assert map_china_site(fetched, board, MOMENT).seen_external_ids == {"tencent:live"}
    assert details == []


def test_plain_text_labels_sections_once_and_unescapes_entities() -> None:
    text = plain_text(
        ("岗位职责", "1. 负责搜索&nbsp;产品\r\n2. 推动迭代"),
        ("岗位要求", "【任职资格】\n本科及以上学历"),
    )
    assert text == "岗位职责\n1. 负责搜索\xa0产品\n2. 推动迭代\n\n【任职资格】\n本科及以上学历"


def test_résumé_channels_with_no_real_description_are_dropped() -> None:
    def posting(external_id: str, title: str, description: str) -> ChinaPosting:
        return ChinaPosting(
            external_id=external_id,
            title=title,
            places=("广州市",),
            description=description,
            url=f"https://hr.163.com/job-detail.html?id={external_id}",
            posted=None,
            employment=JobEmploymentType.UNKNOWN,
        )

    fetched = ChinaSiteFetch(
        (
            posting("1", "广州程序类岗位专项", "职位描述\n服务器开发/客户端开发等"),
            posting("2", "核心人才交流岗位", "职位描述\n核心人才交流\n\n职位要求\n核心人才交流"),
            posting("3", "服务端开发工程师", f"职位描述\n{DUTY}\n\n职位要求\n{NEED}"),
        )
    )
    mapping = map_china_site(fetched, SourceBoard("netease", "网易"), MOMENT)
    assert [c.external_job_id for c in mapping.candidates] == ["3"]


@pytest.mark.asyncio
async def test_a_single_network_error_is_retried(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("careeros_api.job_source_china.RETRY_PAUSE_SECONDS", 0)
    jobs = [
        {"id": 1, "name": "游戏策划", "workType": "0", "workPlaceNameList": ["杭州市"],
         "description": DUTY, "requirement": NEED},
    ]  # fmt: skip
    failures = {"left": 1}

    def handle(request: httpx.Request) -> httpx.Response:
        if request.url.path == "/robots.txt":
            return httpx.Response(404)
        if failures["left"]:
            failures["left"] -= 1
            raise httpx.ReadTimeout("slow", request=request)
        return httpx.Response(200, json={"code": 200, "data": {"list": jobs, "pages": 1}})

    fetched, board = await run("netease", handle)
    assert ids(fetched, board) == {"netease:1"}
