"""Guopin (国聘) field mapping.

The two sample rows below are real rows the user's collaborator provided on
2026-09-28 (job_id 212660741537267837 and 219181344092062369), trimmed only in
`contents` length for test readability.

Generic row-loading and file-adapter behavior is covered in
`test_job_source_file_adapter.py`, not here.
"""

import pytest
from pydantic import ValidationError

from careeros_api.job_source_file_adapter import FileJobSourceAdapter
from careeros_api.job_source_guopin import GUOPIN_SOURCE_KEY, map_row
from careeros_api.models import JobCountry, JobEmploymentType, JobMarket, JobWorkplaceType

SAMPLE_ROW_A: dict[str, object] = {
    "job_id": "212660741537267837",
    "job_name": "中级软件开发工程师",
    "job_nature": "社招",
    "job_category": "软件研发工程师",
    "recruit_count ": "若干",
    "wage_min": 15000,
    "wage_max": 25000,
    "wage_unit": "元/月",
    "paycheck_count": 14,
    "wage_is_negotiable": False,
    "education": "本科",
    "experience": "3-5年",
    "is_graduates": False,
    "major": ["计算机类", "自动化类", "软件工程类"],
    "job_industry": ["运营商/增值服务", "计算机软件", "通信/网络设备"],
    "job_tags": ["HTML", "CSS", "后端开发", "MySQL"],
    "start_time": "2026-08-07 00:00:00",
    "end_time": "2026-10-31 23:59:59",
    "contents": (
        "1.负责动环监控系统、边缘计算主机协议转换器、运维系统等产品的软件开发、测试、维护等工作;\n"
        "2.负责软件系统的详细设计文档、接口文档、部署运维手册等技术文档的编写。"
    ),
    "department": "北京市海讯达通信有限责任公司",
    "job_address": [],
    "company_id": "10685404230552689",
    "company_name": "北京市海讯达通信有限责任公司",
    "company_industry": "建筑安装业",
    "company_nature": "国企",
    "company_scale": "300-500人",
    "company_address": [],
    "apply_url": "https://c.iguopin.com/apply?job_id=212660741537267837",
    "source_id": 1,
    "source": "国聘",
    "source_en": "guopin",
    "crawl_time": "2026-09-28T14:08:59.972329+08:00",
    "job_fp": "c07f460928b6397e1eb34cf3a13696f4",
}

SAMPLE_ROW_B: dict[str, object] = {
    "job_id": "219181344092062369",
    "job_name": "产品技术工程师（北京）",
    "job_nature": "社招",
    "job_category": "产品专员",
    "recruit_count ": 3,
    "wage_min": 10000,
    "wage_max": 15000,
    "wage_unit": "元/月",
    "paycheck_count": 12,
    "wage_is_negotiable": False,
    "education": "本科",
    "experience": "5-10年",
    "is_graduates": False,
    "major": ["工学全类"],
    "job_industry": ["计算机软件", "企业服务"],
    "job_tags": ["智慧城市", "人工智能"],
    "start_time": "2026-09-21 00:00:00",
    "end_time": "2026-12-17 23:59:59",
    "contents": (
        "岗位职责：\n1.负责行业政策、技术趋势调研分析。\n任职要求：\n1.大学本科及以上学历，8年及以上相关工作经验。"
    ),
    "department": "轨道分公司",
    "job_address": ["北京-丰台区 汽车博物馆南路1号院"],
    "company_id": "10685325596730285",
    "company_name": "通号通信信息集团有限公司",
    "company_industry": "信息传输、软件和信息技术服务业",
    "company_nature": "国企",
    "company_scale": "500-1000人",
    "company_address": ["中国-北京-北京市-丰台区 北京市丰台区汽车博物馆南路1号院中国通号大厦A座"],
    "apply_url": "https://c.iguopin.com/apply?job_id=219181344092062369",
    "source_id": 1,
    "source": "国聘",
    "source_en": "guopin",
    "crawl_time": "2026-09-28T14:04:57.931829+08:00",
    "job_fp": "34b327b7810158aa35d03a4d6cf1d06c",
}


def test_map_row_reads_required_fields_from_a_real_sample() -> None:
    candidate = map_row(SAMPLE_ROW_A)

    assert candidate.external_job_id == "212660741537267837"
    assert candidate.company == "北京市海讯达通信有限责任公司"
    assert candidate.title == "中级软件开发工程师"
    assert "动环监控系统" in candidate.description


def test_map_row_parses_the_timezone_aware_crawl_time() -> None:
    candidate = map_row(SAMPLE_ROW_A)

    assert candidate.observed_at.isoformat() == "2026-09-28T14:08:59.972329+08:00"


def test_map_row_hardcodes_china_market_for_this_source() -> None:
    candidate = map_row(SAMPLE_ROW_A)

    assert candidate.market is JobMarket.CHINA
    assert candidate.country_code is JobCountry.CN


def test_map_row_uses_the_apply_url_as_application_url() -> None:
    candidate = map_row(SAMPLE_ROW_A)

    assert str(candidate.application_url) == "https://c.iguopin.com/apply?job_id=212660741537267837"


def test_map_row_prefers_job_address_over_company_address() -> None:
    candidate = map_row(SAMPLE_ROW_B)

    assert candidate.location == "北京-丰台区 汽车博物馆南路1号院"


def test_map_row_leaves_location_none_when_no_address_is_given() -> None:
    candidate = map_row(SAMPLE_ROW_A)

    assert candidate.location is None


def test_map_row_leaves_workplace_type_unknown() -> None:
    candidate = map_row(SAMPLE_ROW_A)

    assert candidate.workplace_type is JobWorkplaceType.UNKNOWN


def test_map_row_maps_shehui_zhaopin_to_full_time() -> None:
    """社招 (experienced-hire recruiting) is a full-time position."""

    candidate = map_row(SAMPLE_ROW_A)

    assert candidate.employment_type is JobEmploymentType.FULL_TIME


def test_map_row_maps_xiaozhao_to_full_time() -> None:
    """校招 (campus recruiting for new graduates) is also full-time."""

    row = dict(SAMPLE_ROW_A)
    row["job_nature"] = "校招"

    candidate = map_row(row)

    assert candidate.employment_type is JobEmploymentType.FULL_TIME


def test_map_row_leaves_employment_type_unknown_for_an_unrecognized_job_nature() -> None:
    row = dict(SAMPLE_ROW_A)
    row["job_nature"] = "实习"

    candidate = map_row(row)

    assert candidate.employment_type is JobEmploymentType.UNKNOWN


def test_map_row_rejects_a_crawl_time_without_a_timezone() -> None:
    bad_row = dict(SAMPLE_ROW_A)
    bad_row["crawl_time"] = "2026-09-28 14:08:59"

    with pytest.raises(ValidationError, match="observed_at"):
        map_row(bad_row)


def test_map_row_rejects_a_missing_required_field() -> None:
    bad_row = dict(SAMPLE_ROW_A)
    del bad_row["company_name"]

    with pytest.raises(KeyError):
        map_row(bad_row)


@pytest.mark.asyncio
async def test_adapter_wires_guopin_source_key_and_mapper() -> None:
    adapter = FileJobSourceAdapter(
        [SAMPLE_ROW_A, SAMPLE_ROW_B],
        source_key=GUOPIN_SOURCE_KEY,
        mapper=map_row,
    )

    candidates = await adapter.fetch_candidates()

    assert adapter.source_key == GUOPIN_SOURCE_KEY
    assert [candidate.external_job_id for candidate in candidates] == [
        "212660741537267837",
        "219181344092062369",
    ]
