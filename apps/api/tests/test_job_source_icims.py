"""iCIMS portal reader, offline through a mock transport."""

import json
from datetime import UTC, datetime, timedelta

import httpx
import pytest

from careeros_api.job_source_boards import BoardFetchError, SourceBoard
from careeros_api.job_source_icims import fetch_site, map_portal
from careeros_api.models import JobCountry, JobEmploymentType

SITE = "https://careers-acme.icims.com"
BOARD = SourceBoard("acme", "Acme", SITE)
MOMENT = datetime(2026, 10, 10, tzinfo=UTC)
JOB = f"{SITE}/jobs/4830/test-engineer/job"
OLD = f"{SITE}/jobs/4831/closed-role/job"
ROBOTS = "User-agent: *\nDisallow: /jobs/*login\nDisallow: /jobs/*candidate\n"


def framed(
    valid_through: str = "2027-10-10T00:00:00Z",
    country: str = "US",
    date_posted: str = "2026-09-01T00:00:00Z",
) -> str:
    posting = {
        "@type": "JobPosting",
        "title": "Test Engineer",
        "description": "<p>Design test systems for our audio products.</p>",
        "datePosted": date_posted,
        "validThrough": valid_through,
        "employmentType": "FULL_TIME",
        "jobLocation": [
            {
                "address": {
                    "addressLocality": "Niles",
                    "addressRegion": "IL",
                    "addressCountry": country,
                }
            }
        ],
    }
    return f'<script type="application/ld+json">{json.dumps(posting)}</script>'


async def run(routes: dict[str, httpx.Response], requested: list[str]):  # type: ignore[no-untyped-def]
    def handle(request: httpx.Request) -> httpx.Response:
        requested.append(str(request.url))
        return routes.get(str(request.url), httpx.Response(404))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        return await fetch_site(client, BOARD, {}, pause=0)


def base(urls: list[str]) -> dict[str, httpx.Response]:
    body = "".join(f"<url><loc>{u}</loc></url>" for u in [f"{SITE}/jobs/search", *urls])
    return {
        f"{SITE}/robots.txt": httpx.Response(200, text=ROBOTS),
        f"{SITE}/sitemap.xml": httpx.Response(200, text=f"<urlset>{body}</urlset>"),
    }


@pytest.mark.asyncio
async def test_reads_framed_pages_and_records_plain_urls() -> None:
    requested: list[str] = []
    routes = base([JOB]) | {f"{JOB}?in_iframe=1": httpx.Response(200, text=framed())}
    fetched = await run(routes, requested)
    (candidate,) = map_portal(fetched, BOARD, MOMENT).candidates

    assert f"{JOB}?in_iframe=1" in requested
    assert candidate.external_job_id == "acme:4830"
    assert str(candidate.source_url) == JOB
    assert candidate.country_code == JobCountry.US
    assert candidate.employment_type == JobEmploymentType.FULL_TIME


@pytest.mark.asyncio
async def test_expired_postings_are_not_kept() -> None:
    requested: list[str] = []
    routes = base([OLD]) | {
        f"{OLD}?in_iframe=1": httpx.Response(200, text=framed("2026-01-01T00:00:00Z"))
    }
    mapping = map_portal(await run(routes, requested), BOARD, MOMENT)
    assert mapping.candidates == ()
    assert mapping.skipped_not_opening == 1


@pytest.mark.asyncio
async def test_invalid_site_url_is_rejected() -> None:
    async with httpx.AsyncClient() as client:
        with pytest.raises(BoardFetchError, match="site_url"):
            await fetch_site(
                client, SourceBoard("acme", "Acme", "https://evil.example"), {}, pause=0
            )


@pytest.mark.asyncio
async def test_two_years_ago_placeholder_date_counts_as_unknown() -> None:
    placeholder = (datetime.now(UTC) - timedelta(days=730)).isoformat()
    requested: list[str] = []
    routes = base([JOB]) | {
        f"{JOB}?in_iframe=1": httpx.Response(200, text=framed(date_posted=placeholder))
    }
    fetched = await run(routes, requested)
    assert fetched.postings[0].posted is None
