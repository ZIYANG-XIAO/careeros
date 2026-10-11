"""Large-employer career-site readers, offline through a mock transport."""

import json
from collections.abc import Callable
from datetime import UTC, datetime
from urllib.parse import parse_qs, urlsplit

import httpx
import pytest

from careeros_api.job_source_boards import BoardFetchError, SourceBoard
from careeros_api.job_source_careersite import (
    AMAZON_QUERY_CAP,
    apple_posting,
    fetch_site,
    map_site,
)
from careeros_api.models import JobCountry, JobEmploymentType, JobWorkplaceType

MOMENT = datetime(2026, 10, 10, tzinfo=UTC)
ALLOW_ALL = httpx.Response(404)


async def run(
    token: str,
    handler: Callable[[httpx.Request], httpx.Response],
    known: dict[str, str] | None = None,
) -> tuple[object, SourceBoard]:
    board = SourceBoard(token, token.title())
    async with httpx.AsyncClient(transport=httpx.MockTransport(handler)) as client:
        return await fetch_site(client, board, known or {}, pause=0), board


# --- Amazon -----------------------------------------------------------------


def amazon_job(job_id: str, country: str = "USA", **overrides: object) -> dict[str, object]:
    job: dict[str, object] = {
        "id_icims": job_id,
        "title": "Software Development Engineer",
        "normalized_location": "Seattle, Washington, USA"
        if country == "USA"
        else "Toronto, ON, CAN",
        "country_code": country,
        "description": "<p>Build services used by millions of customers.</p>",
        "basic_qualifications": "- 3+ years of software development",
        "preferred_qualifications": "",
        "job_path": f"/en/jobs/{job_id}/sde",
        "posted_date": "July 31, 2026",
        "job_schedule_type": "full-time",
    }
    job.update(overrides)
    return job


def amazon_handler(
    by_query: Callable[
        [dict[str, list[str]]], tuple[int, list[dict[str, object]], dict[str, object]]
    ],
    pages: dict[str, int] | None = None,
) -> Callable[[httpx.Request], httpx.Response]:
    def handle(request: httpx.Request) -> httpx.Response:
        url = urlsplit(str(request.url))
        if url.path == "/robots.txt":
            return httpx.Response(200, text="User-agent: *\nDisallow: /internal\n")
        if url.path.startswith("/en/jobs/"):
            return httpx.Response(
                404 if (pages or {}).get(url.path) == 404 else 200, text="<html/>"
            )
        query = parse_qs(url.query)
        hits, jobs, facets = by_query(query)
        offset = int(query.get("offset", ["0"])[0])
        limit = int(query["result_limit"][0])
        return httpx.Response(
            200, json={"hits": hits, "jobs": jobs[offset : offset + limit], "facets": facets}
        )

    return handle


@pytest.mark.asyncio
async def test_amazon_reads_us_and_canada_and_maps_postings() -> None:
    def by_query(
        query: dict[str, list[str]],
    ) -> tuple[int, list[dict[str, object]], dict[str, object]]:
        if query["normalized_country_code[]"] == ["USA"]:
            jobs = [amazon_job(str(i)) for i in range(150)]
        else:
            jobs = [amazon_job("C1", "CAN")]
        return len(jobs), jobs, {}

    fetched, board = await run("amazon", amazon_handler(by_query))
    mapping = map_site(fetched, board, MOMENT)

    assert len(mapping.candidates) == 151  # paged past the first 100
    us = next(c for c in mapping.candidates if c.external_job_id == "amazon:0")
    assert us.country_code == JobCountry.US
    assert us.employment_type == JobEmploymentType.FULL_TIME
    assert us.posted_at == datetime(2026, 7, 31, tzinfo=UTC)
    assert str(us.source_url) == "https://www.amazon.jobs/en/jobs/0/sde"
    assert "Basic qualifications" in us.description
    ca = next(c for c in mapping.candidates if c.external_job_id == "amazon:C1")
    assert ca.country_code == JobCountry.CA


@pytest.mark.asyncio
async def test_amazon_splits_a_capped_country_by_category() -> None:
    seen_categories: list[str] = []

    def by_query(
        query: dict[str, list[str]],
    ) -> tuple[int, list[dict[str, object]], dict[str, object]]:
        if query["normalized_country_code[]"] == ["CAN"]:
            return 0, [], {}
        category = query.get("category[]", [None])[0]
        if category is None:
            facets = {"category_facet": [{"Software Development": 2}, {"Operations": 1}]}
            return AMAZON_QUERY_CAP, [amazon_job("X")], facets
        seen_categories.append(category)
        jobs = [
            amazon_job(f"{category[:3]}{i}") for i in range(2 if category.startswith("S") else 1)
        ]
        return len(jobs), jobs, {}

    fetched, board = await run("amazon", amazon_handler(by_query))
    ids = {c.external_job_id for c in map_site(fetched, board, MOMENT).candidates}

    assert set(seen_categories) == {"Software Development", "Operations"}
    assert ids == {"amazon:Sof0", "amazon:Sof1", "amazon:Ope0"}


@pytest.mark.asyncio
async def test_amazon_complete_listing_closes_missing_postings() -> None:
    def by_query(
        query: dict[str, list[str]],
    ) -> tuple[int, list[dict[str, object]], dict[str, object]]:
        jobs = [amazon_job("1")] if query["normalized_country_code[]"] == ["USA"] else []
        return len(jobs), jobs, {}

    known = {"amazon:GONE": "https://www.amazon.jobs/en/jobs/GONE/x"}
    fetched, board = await run("amazon", amazon_handler(by_query), known)
    assert map_site(fetched, board, MOMENT).seen_external_ids == {"amazon:1"}


# --- Microsoft ----------------------------------------------------------------

MS_ROBOTS = "User-agent: *\nDisallow: /\nAllow: /careers\nAllow: /api/pcsx\n"


def ms_handler(
    positions: dict[str, list[dict[str, object]]], requested: list[str]
) -> Callable[[httpx.Request], httpx.Response]:
    def handle(request: httpx.Request) -> httpx.Response:
        url = urlsplit(str(request.url))
        requested.append(str(request.url))
        query = parse_qs(url.query)
        if url.path == "/robots.txt":
            return httpx.Response(200, text=MS_ROBOTS)
        if url.path == "/api/pcsx/search":
            items = positions[query["location"][0]]
            start = int(query["start"][0])
            return httpx.Response(
                200, json={"data": {"count": len(items), "positions": items[start : start + 10]}}
            )
        if url.path == "/api/pcsx/position_details":
            return httpx.Response(
                200,
                json={
                    "data": {
                        "name": "Software Engineer",
                        "jobDescription": "<p>Ship features to Azure customers worldwide.</p>",
                        "efcustomTextEmploymentType": ["Full-Time"],
                        "efcustomTextWorkSite": ["0 days / week in-office – remote"],
                    }
                },
            )
        return httpx.Response(404)

    return handle


def ms_position(position_id: int, standardized: list[str]) -> dict[str, object]:
    return {
        "id": position_id,
        "name": "Software Engineer",
        "locations": ["United States, Washington, Redmond"],
        "standardizedLocations": standardized,
        "postedTs": 1791292136,
        "workLocationOption": "onsite",
    }


@pytest.mark.asyncio
async def test_microsoft_keeps_us_and_canada_and_reads_details() -> None:
    positions = {
        "United States": [ms_position(i, ["Redmond, WA, US"]) for i in range(12)]
        + [ms_position(99, ["Bengaluru, KA, IN"])],
        "Canada": [ms_position(200, ["Toronto, ON, CA"])],
    }
    requested: list[str] = []
    fetched, board = await run("microsoft", ms_handler(positions, requested))
    mapping = map_site(fetched, board, MOMENT)

    ids = {c.external_job_id for c in mapping.candidates}
    assert ids == {f"microsoft:{i}" for i in range(12)} | {"microsoft:200"}
    assert mapping.skipped_outside_market == 1
    first = next(c for c in mapping.candidates if c.external_job_id == "microsoft:0")
    assert first.employment_type == JobEmploymentType.FULL_TIME
    assert first.workplace_type == JobWorkplaceType.REMOTE
    assert str(first.source_url) == "https://apply.careers.microsoft.com/careers/job/0"


@pytest.mark.asyncio
async def test_microsoft_does_not_refetch_known_details() -> None:
    positions = {"United States": [ms_position(1, ["US"])], "Canada": []}
    requested: list[str] = []
    known = {"microsoft:1": "https://apply.careers.microsoft.com/careers/job/1"}
    fetched, board = await run("microsoft", ms_handler(positions, requested), known)

    assert not any("position_details" in url for url in requested)
    assert map_site(fetched, board, MOMENT).seen_external_ids == {"microsoft:1"}


# --- Meta and Apple (sitemaps) ---------------------------------------------------


def meta_page(country: str = "US") -> str:
    posting = {
        "@type": "JobPosting",
        "title": "Production Engineer",
        "description": "<p>Keep the infrastructure behind our apps reliable.</p>",
        "datePosted": "2026-10-05T16:47:12-07:00",
        "employmentType": "FULL_TIME",
        "jobLocation": [
            {"@type": "Place", "name": "Menlo Park, CA", "address": {"addressCountry": country}}
        ],
    }
    return f'<script type="application/ld+json" nonce="x">{json.dumps(posting)}</script>'


@pytest.mark.asyncio
async def test_meta_reads_sitemap_job_pages() -> None:
    us = "https://www.metacareers.com/profile/job_details/111/"
    abroad = "https://www.metacareers.com/profile/job_details/222/"
    sitemap = f"<urlset><url><loc>{us}</loc></url><url><loc>{abroad}</loc></url></urlset>"

    def handle(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        if url.endswith("/robots.txt"):
            return httpx.Response(200, text="User-agent: *\nDisallow: /login/\n")
        if url.endswith("/jobsearch/sitemap.xml"):
            return httpx.Response(200, text=sitemap)
        return httpx.Response(200, text=meta_page("US" if url == us else "SG"))

    fetched, board = await run("meta", handle)
    (candidate,) = map_site(fetched, board, MOMENT).candidates
    assert candidate.external_job_id == "meta:111"
    assert candidate.location == "Menlo Park, CA"
    assert candidate.country_code == JobCountry.US


def apple_page(title: str = "Software Engineer") -> str:
    data = {
        "loaderData": {
            "details": {
                "jobsData": {
                    "jobNumber": "200676091-3810",
                    "postingTitle": title,
                    "jobSummary": "Imagine what you could do here.",
                    "description": "Build the next generation of Apple software.",
                    "minimumQualifications": "BS in Computer Science",
                    "locations": [{"name": "Cupertino", "countryName": "United States"}],
                    "postDateInGMT": "2026-08-05T17:13:13.208+00:00",
                    "homeOffice": False,
                }
            }
        }
    }
    literal = json.dumps(json.dumps(data))[1:-1]
    return f'<script>window.__staticRouterHydrationData = JSON.parse("{literal}");</script>'


def test_apple_posting_is_read_from_embedded_router_data() -> None:
    posting = apple_posting(apple_page())
    assert posting is not None and posting["postingTitle"] == "Software Engineer"
    assert apple_posting("<html>no data</html>") is None


@pytest.mark.asyncio
async def test_apple_reads_us_sitemap_and_maps_internships() -> None:
    url = "https://jobs.apple.com/en-us/details/200676091-3810/software-engineering-intern"

    def handle(request: httpx.Request) -> httpx.Response:
        if str(request.url).endswith("/robots.txt"):
            return ALLOW_ALL
        if str(request.url).endswith("sitemap-jobs-en-us.xml"):
            return httpx.Response(200, text=f"<urlset><url><loc>{url}</loc></url></urlset>")
        return httpx.Response(200, text=apple_page("Software Engineering Intern"))

    fetched, board = await run("apple", handle)
    (candidate,) = map_site(fetched, board, MOMENT).candidates
    assert candidate.external_job_id == "apple:200676091-3810"
    assert candidate.country_code == JobCountry.US
    assert candidate.employment_type == JobEmploymentType.INTERNSHIP
    assert "BS in Computer Science" in candidate.description


# --- shared rules -----------------------------------------------------------------


@pytest.mark.asyncio
async def test_robots_disallow_fails_the_site_before_reading_jobs() -> None:
    requested: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requested.append(str(request.url))
        return httpx.Response(200, text="User-agent: *\nDisallow: /\n")

    with pytest.raises(BoardFetchError, match="robots.txt"):
        await run("meta", handle)
    assert len(requested) == 1


@pytest.mark.asyncio
async def test_unknown_employer_is_rejected() -> None:
    with pytest.raises(BoardFetchError, match="no career-site reader"):
        await run("google", lambda request: httpx.Response(404))


@pytest.mark.asyncio
async def test_eightfold_v2_site_filters_by_place_and_reads_details() -> None:
    positions = [
        {
            "id": 1,
            "name": "Senior Engineer",
            "locations": ["Los Gatos,California"],
            "t_create": 1791158400,
        },
        {
            "id": 2,
            "name": "Ads Specialist",
            "locations": ["Singapore,Singapore"],
            "t_create": 1791158400,
        },
    ]

    def handle(request: httpx.Request) -> httpx.Response:
        url = urlsplit(str(request.url))
        if url.path == "/robots.txt":
            return httpx.Response(
                200, text="User-agent: *\nDisallow: /\nAllow: /careers\nAllow: /api/apply\n"
            )
        if url.path == "/api/apply/v2/jobs":
            start = int(parse_qs(url.query)["start"][0])
            return httpx.Response(200, json={"count": 2, "positions": positions[start:]})
        if url.path == "/api/apply/v2/jobs/1":
            return httpx.Response(
                200,
                json={
                    "name": "Senior Engineer",
                    "job_description": "<p>Build the streaming platform.</p>",
                },
            )
        return httpx.Response(404)

    fetched, board = await run("netflix", handle)
    mapping = map_site(fetched, board, MOMENT)
    (candidate,) = mapping.candidates
    assert candidate.external_job_id == "netflix:1"
    assert candidate.location == "Los Gatos, California"
    assert candidate.country_code == JobCountry.US
    assert str(candidate.source_url) == "https://explore.jobs.netflix.net/careers/job/1"
    assert mapping.skipped_outside_market == 1
