"""Oracle Recruiting Cloud reader, offline through a mock transport."""

from datetime import UTC, datetime
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from careeros_api.job_source_boards import BoardFetchError, SourceBoard
from careeros_api.job_source_oracle import PAGE_SIZE, fetch_site, map_oracle_site
from careeros_api.models import JobCountry, JobEmploymentType

SITE = "https://acme.fa.us2.oraclecloud.com/hcmUI/CandidateExperience/en/sites/CX_1"
BOARD = SourceBoard("acme.cx_1", "Acme", SITE)
MOMENT = datetime(2026, 10, 10, tzinfo=UTC)


def req(job_id: str, country: str = "US") -> dict[str, object]:
    return {
        "Id": job_id,
        "Title": "Software Engineer",
        "PrimaryLocation": "Columbus, OH, United States"
        if country == "US"
        else "London, United Kingdom",
        "PrimaryLocationCountry": country,
        "secondaryLocations": [],
    }


def handler(reqs: list[dict[str, object]], requested: list[str], end_date: str | None = None):  # type: ignore[no-untyped-def]
    def handle(request: httpx.Request) -> httpx.Response:
        url = urlsplit(str(request.url))
        requested.append(str(request.url))
        if url.path == "/robots.txt":
            return httpx.Response(404)
        finder = parse_qs(url.query).get("finder", [""])[0]
        if url.path.endswith("/recruitingCEJobRequisitions"):
            offset = int(finder.split("offset=")[1].split(",")[0])
            page = reqs[offset : offset + PAGE_SIZE]
            return httpx.Response(
                200, json={"items": [{"TotalJobsCount": len(reqs), "requisitionList": page}]}
            )
        if url.path.endswith("/recruitingCEJobRequisitionDetails"):
            detail: dict[str, object] = {
                "Title": "Software Engineer",
                "ExternalDescriptionStr": "<p>Build the systems behind our banking products.</p>",
                "ExternalPostedStartDate": "2026-10-01T00:00:00+00:00",
                "JobSchedule": "Full time",
            }
            if end_date:
                detail["ExternalPostedEndDate"] = end_date
            return httpx.Response(200, json={"items": [detail]})
        return httpx.Response(404)

    return handle


async def run(handle, known: dict[str, str] | None = None):  # type: ignore[no-untyped-def]
    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        return await fetch_site(client, BOARD, known or {}, pause=0)


@pytest.mark.asyncio
async def test_pages_the_list_keeps_north_america_and_reads_details() -> None:
    reqs = [req(str(i)) for i in range(PAGE_SIZE + 5)] + [req("UK1", "GB")]
    requested: list[str] = []
    mapping = map_oracle_site(await run(handler(reqs, requested)), BOARD, MOMENT)

    assert len(mapping.candidates) == PAGE_SIZE + 5
    assert mapping.skipped_outside_market == 1
    first = next(c for c in mapping.candidates if c.external_job_id == "acme.cx_1:0")
    assert first.country_code == JobCountry.US
    assert first.employment_type == JobEmploymentType.FULL_TIME
    assert str(first.source_url) == f"{SITE}/job/0"
    assert first.description == "Build the systems behind our banking products."


@pytest.mark.asyncio
async def test_known_postings_skip_details_and_absent_ones_close() -> None:
    requested: list[str] = []
    known = {"acme.cx_1:1": f"{SITE}/job/1", "acme.cx_1:GONE": f"{SITE}/job/GONE"}
    fetched = await run(handler([req("1")], requested), known)

    assert not any("Details" in url for url in requested)
    assert map_oracle_site(fetched, BOARD, MOMENT).seen_external_ids == {"acme.cx_1:1"}


@pytest.mark.asyncio
async def test_postings_past_their_end_date_are_not_kept() -> None:
    requested: list[str] = []
    fetched = await run(handler([req("1")], requested, end_date="2026-01-01T00:00:00+00:00"))
    mapping = map_oracle_site(fetched, BOARD, MOMENT)
    assert mapping.candidates == ()
    assert mapping.skipped_not_opening == 1


@pytest.mark.asyncio
async def test_robots_disallow_fails_the_site() -> None:
    def handle(request: httpx.Request) -> httpx.Response:
        return httpx.Response(200, text="User-agent: *\nDisallow: /hcmRestApi\n")

    with pytest.raises(BoardFetchError, match="robots.txt"):
        await run(handle)
