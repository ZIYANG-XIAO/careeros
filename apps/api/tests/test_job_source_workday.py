"""Workday sitemap + JSON-LD adapter, offline through a mock transport."""

import json
from collections.abc import Callable
from datetime import UTC, datetime

import httpx
import pytest

from careeros_api.job_source_boards import BoardFetchError, SourceBoard
from careeros_api.job_source_workday import (
    SITEMAP_CAP,
    fetch_site,
    map_site,
    worth_fetching,
)
from careeros_api.models import JobCountry, JobEmploymentType, JobWorkplaceType

SITE = "https://acme.wd5.myworkdayjobs.com/AcmeCareers"
BOARD = SourceBoard("acme.acmecareers", "Acme", SITE)
MOMENT = datetime(2026, 10, 9, 12, tzinfo=UTC)
ROBOTS = "\n".join(
    [
        f"Sitemap: {SITE}/siteMap.xml",
        "",
        "User-agent: *",
        "Allow: /AcmeCareers/",
        "Disallow: /refreshFacet/",
    ]
)


def job_url(place: str, req: str) -> str:
    return f"{SITE}/job/{place}/Platform-Engineer_{req}"


def sitemap(urls: list[str]) -> str:
    body = "".join(f"<url><loc>{url}</loc></url>" for url in urls)
    return f'<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>'


def job_page(country: str = "United States of America", **overrides: object) -> str:
    posting: dict[str, object] = {
        "@context": "http://schema.org",
        "@type": "JobPosting",
        "title": "Platform Engineer",
        "description": "<p>Build the platform that powers our products.</p>",
        "datePosted": "2026-10-08",
        "employmentType": "FULL_TIME",
        "jobLocation": {
            "@type": "Place",
            "address": {
                "@type": "PostalAddress",
                "addressLocality": "Santa Clara",
                "addressRegion": "CA",
                "addressCountry": country,
            },
        },
    }
    posting.update(overrides)
    return f'<html><script type="application/ld+json">{json.dumps(posting)}</script></html>'


def transport(
    routes: dict[str, httpx.Response], requested: list[str]
) -> Callable[[httpx.Request], httpx.Response]:
    def handle(request: httpx.Request) -> httpx.Response:
        url = str(request.url)
        requested.append(url)
        return routes.get(url, httpx.Response(404))

    return handle


async def run(
    routes: dict[str, httpx.Response], known: dict[str, str] | None = None, **kwargs: int
) -> tuple[object, list[str]]:
    requested: list[str] = []
    async with httpx.AsyncClient(transport=httpx.MockTransport(transport(routes, requested))) as c:
        result = await fetch_site(c, BOARD, known or {}, pause=0, **kwargs)
    return result, requested


def base_routes(urls: list[str]) -> dict[str, httpx.Response]:
    return {
        "https://acme.wd5.myworkdayjobs.com/robots.txt": httpx.Response(200, text=ROBOTS),
        f"{SITE}/siteMap.xml": httpx.Response(200, text=sitemap(urls)),
    }


@pytest.mark.asyncio
async def test_maps_a_north_american_posting_from_json_ld() -> None:
    url = job_url("US-CA-Santa-Clara", "JR100")
    routes = base_routes([url]) | {url: httpx.Response(200, text=job_page())}
    fetched, _ = await run(routes)
    mapping = map_site(fetched, BOARD, MOMENT)

    (candidate,) = mapping.candidates
    assert candidate.external_job_id == "acme.acmecareers:JR100"
    assert candidate.company == "Acme"
    assert candidate.title == "Platform Engineer"
    assert candidate.location == "Santa Clara, CA, United States of America"
    assert candidate.country_code == JobCountry.US
    assert candidate.employment_type == JobEmploymentType.FULL_TIME
    assert candidate.workplace_type == JobWorkplaceType.UNKNOWN
    assert candidate.posted_at == datetime(2026, 10, 8, tzinfo=UTC)
    assert str(candidate.application_url) == url
    assert candidate.description == "Build the platform that powers our products."


@pytest.mark.asyncio
async def test_skips_pages_whose_url_places_them_outside_north_america() -> None:
    abroad = job_url("India-Bangalore", "JR200")
    remote = job_url("Remote", "JR201")
    routes = base_routes([abroad, remote]) | {
        remote: httpx.Response(200, text=job_page(jobLocationType="TELECOMMUTE"))
    }
    fetched, requested = await run(routes)
    mapping = map_site(fetched, BOARD, MOMENT)

    assert abroad not in requested
    assert [c.external_job_id for c in mapping.candidates] == ["acme.acmecareers:JR201"]
    assert mapping.candidates[0].workplace_type == JobWorkplaceType.REMOTE
    assert mapping.skipped_outside_market == 1


@pytest.mark.asyncio
async def test_page_with_a_foreign_country_is_not_kept() -> None:
    url = job_url("Multiple-Locations", "JR300")
    routes = base_routes([url]) | {url: httpx.Response(200, text=job_page("Germany"))}
    fetched, _ = await run(routes)
    assert map_site(fetched, BOARD, MOMENT).candidates == ()


@pytest.mark.asyncio
async def test_known_postings_are_not_refetched_and_stay_open() -> None:
    url = job_url("US-CA-Santa-Clara", "JR100")
    known = {"acme.acmecareers:JR100": url}
    fetched, requested = await run(base_routes([url]), known)
    mapping = map_site(fetched, BOARD, MOMENT)

    assert url not in requested
    assert mapping.candidates == ()
    assert mapping.seen_external_ids == {"acme.acmecareers:JR100"}


@pytest.mark.asyncio
async def test_complete_sitemap_closes_postings_by_absence() -> None:
    gone = job_url("US-CA-Santa-Clara", "JR999")
    known = {"acme.acmecareers:JR999": gone}
    fetched, requested = await run(base_routes([]), known)

    assert gone not in requested
    assert map_site(fetched, BOARD, MOMENT).seen_external_ids == frozenset()


@pytest.mark.asyncio
async def test_capped_sitemap_rechecks_absent_postings_before_closing() -> None:
    listed = [job_url("US-NY-New-York", f"JR{i}") for i in range(SITEMAP_CAP)]
    alive = job_url("US-CA-Santa-Clara", "JRALIVE")
    gone = job_url("US-CA-Santa-Clara", "JRGONE")
    flaky = job_url("US-CA-Santa-Clara", "JRFLAKY")
    unchecked = job_url("US-CA-Santa-Clara", "JRLATER")
    known = {f"acme.acmecareers:JR{i}": url for i, url in enumerate(listed)} | {
        "acme.acmecareers:JRALIVE": alive,
        "acme.acmecareers:JRGONE": gone,
        "acme.acmecareers:JRFLAKY": flaky,
        "acme.acmecareers:JRLATER": unchecked,
    }
    routes = base_routes(listed) | {
        alive: httpx.Response(200, text=job_page()),
        gone: httpx.Response(404),
        flaky: httpx.Response(503),
    }
    fetched, requested = await run(routes, known, max_rechecks=3)
    seen = map_site(fetched, BOARD, MOMENT).seen_external_ids

    assert "acme.acmecareers:JRALIVE" in seen
    assert "acme.acmecareers:JRGONE" not in seen
    assert "acme.acmecareers:JRFLAKY" in seen
    assert "acme.acmecareers:JRLATER" in seen and unchecked not in requested
    assert all(f"acme.acmecareers:JR{i}" in seen for i in range(SITEMAP_CAP))


@pytest.mark.asyncio
async def test_new_page_fetches_are_bounded_per_run() -> None:
    urls = [job_url("US-CA-Santa-Clara", f"JR{i}") for i in range(5)]
    routes = base_routes(urls) | {url: httpx.Response(200, text=job_page()) for url in urls}
    fetched, requested = await run(routes, max_new_pages=2)

    assert len(map_site(fetched, BOARD, MOMENT).candidates) == 2
    assert sum(url in requested for url in urls) == 2


@pytest.mark.asyncio
async def test_robots_disallow_fails_the_board_without_fetching() -> None:
    routes = base_routes([job_url("US-CA-Santa-Clara", "JR100")])
    routes["https://acme.wd5.myworkdayjobs.com/robots.txt"] = httpx.Response(
        200, text="User-agent: *\nDisallow: /\n"
    )
    with pytest.raises(BoardFetchError, match="robots.txt"):
        await run(routes)


@pytest.mark.asyncio
async def test_robots_server_error_fails_the_board() -> None:
    routes = base_routes([])
    routes["https://acme.wd5.myworkdayjobs.com/robots.txt"] = httpx.Response(503)
    with pytest.raises(BoardFetchError):
        await run(routes)


@pytest.mark.asyncio
async def test_unexpected_sitemap_fails_the_board_instead_of_closing_everything() -> None:
    routes = base_routes([])
    routes[f"{SITE}/siteMap.xml"] = httpx.Response(200, text="<html>maintenance</html>")
    with pytest.raises(BoardFetchError, match="urlset"):
        await run(routes, {"acme.acmecareers:JR1": job_url("US-CA-Santa-Clara", "JR1")})


@pytest.mark.asyncio
async def test_board_without_a_valid_site_url_is_rejected() -> None:
    async with httpx.AsyncClient() as client:
        with pytest.raises(BoardFetchError, match="site_url"):
            await fetch_site(client, SourceBoard("acme.x", "Acme"), {}, pause=0)


def test_url_prefilter() -> None:
    assert worth_fetching(job_url("US-CA-Santa-Clara", "J1"))
    assert worth_fetching(job_url("Toronto-ON", "J2"))
    assert worth_fetching(job_url("Remote", "J3"))
    assert worth_fetching(job_url("Multiple-Locations", "J4"))
    assert not worth_fetching(job_url("India-Bangalore", "J5"))
    assert not worth_fetching(job_url("UK-London", "J6"))


@pytest.mark.asyncio
async def test_a_failing_page_is_skipped_without_failing_the_site() -> None:
    good = job_url("US-CA-Santa-Clara", "JRGOOD")
    bad = job_url("US-CA-Santa-Clara", "JRBAD")
    routes = base_routes([bad, good]) | {good: httpx.Response(200, text=job_page())}
    requested: list[str] = []

    def handle(request: httpx.Request) -> httpx.Response:
        requested.append(str(request.url))
        if str(request.url) == bad:
            raise httpx.ReadError("connection reset", request=request)
        return routes.get(str(request.url), httpx.Response(404))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        fetched = await fetch_site(client, BOARD, {}, pause=0)
    mapping = map_site(fetched, BOARD, MOMENT)

    assert requested.count(bad) == 2  # retried once
    assert [c.external_job_id for c in mapping.candidates] == ["acme.acmecareers:JRGOOD"]


@pytest.mark.asyncio
async def test_a_recheck_that_cannot_connect_keeps_the_posting_open() -> None:
    listed = [job_url("US-NY-New-York", f"JR{i}") for i in range(SITEMAP_CAP)]
    unreachable = job_url("US-CA-Santa-Clara", "JRNET")
    known = {f"acme.acmecareers:JR{i}": url for i, url in enumerate(listed)} | {
        "acme.acmecareers:JRNET": unreachable
    }
    routes = base_routes(listed)

    def handle(request: httpx.Request) -> httpx.Response:
        if str(request.url) == unreachable:
            raise httpx.ConnectError("offline", request=request)
        return routes.get(str(request.url), httpx.Response(404))

    async with httpx.AsyncClient(transport=httpx.MockTransport(handle)) as client:
        fetched = await fetch_site(client, BOARD, known, pause=0)

    assert "acme.acmecareers:JRNET" in map_site(fetched, BOARD, MOMENT).seen_external_ids


@pytest.mark.asyncio
async def test_myworkdaysite_urls_are_supported() -> None:
    site = "https://wd1.myworkdaysite.com/recruiting/acme/AcmeJobs"
    board = SourceBoard("acme.acmejobs", "Acme", site)
    url = f"{site}/job/Charlotte-NC/Analyst_R-1"
    routes = {
        "https://wd1.myworkdaysite.com/robots.txt": httpx.Response(200, text="User-agent: *\n"),
        f"{site}/siteMap.xml": httpx.Response(200, text=sitemap([url])),
        url: httpx.Response(200, text=job_page()),
    }
    requested: list[str] = []
    async with httpx.AsyncClient(transport=httpx.MockTransport(transport(routes, requested))) as c:
        fetched = await fetch_site(c, board, {}, pause=0)
    (candidate,) = map_site(fetched, board, MOMENT).candidates
    assert candidate.external_job_id == "acme.acmejobs:R-1"


@pytest.mark.asyncio
async def test_postings_past_valid_through_are_not_kept() -> None:
    url = job_url("US-CA-Santa-Clara", "JR700")
    routes = base_routes([url]) | {
        url: httpx.Response(200, text=job_page(validThrough="2026-01-01T00:00:00.000Z"))
    }
    fetched, _ = await run(routes)
    mapping = map_site(fetched, BOARD, MOMENT)
    assert mapping.candidates == ()
    assert mapping.skipped_not_opening == 1
