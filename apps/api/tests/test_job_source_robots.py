"""RFC 9309 robots.txt matching used by HTML career-page sources."""

import httpx
import pytest

from careeros_api.job_source_boards import BoardFetchError, Robots, SourceBoard, load_robots

MICROSOFT_STYLE = """
User-agent: *
Disallow: /
Allow: /$
Allow: /careers
Allow: /api/pcsx
"""


def test_longest_match_wins_over_an_earlier_broad_disallow() -> None:
    robots = Robots(MICROSOFT_STYLE)
    assert robots.allows("https://x.example/api/pcsx/search?domain=a.com&start=0")
    assert robots.allows("https://x.example/careers/job/123")
    assert robots.allows("https://x.example/")
    assert not robots.allows("https://x.example/admin")
    assert not robots.allows("https://x.example/api/other")


def test_allow_wins_a_tie() -> None:
    robots = Robots("User-agent: *\nDisallow: /jobs\nAllow: /jobs\n")
    assert robots.allows("https://x.example/jobs/1")


def test_wildcards_and_end_anchor() -> None:
    robots = Robots("User-agent: *\nDisallow: /*.php\nDisallow: /*cursor=\nDisallow: /search$\n")
    assert not robots.allows("https://x.example/index.php")
    assert not robots.allows("https://x.example/jobs?cursor=abc")
    assert not robots.allows("https://x.example/search")
    assert robots.allows("https://x.example/search/results")
    assert robots.allows("https://x.example/profile/job_details/1/")


def test_prefix_rules_cover_detail_pages() -> None:
    robots = Robots("User-agent: *\nDisallow: /about/careers/applications/jobs/results\n")
    assert not robots.allows("https://x.example/about/careers/applications/jobs/results/123-eng")


def test_other_bots_groups_do_not_apply_to_us() -> None:
    robots = Robots("User-agent: LinkedInBot\nAllow: /v1/\n\nUser-agent: *\nDisallow: /\n")
    assert not robots.allows("https://x.example/v1/companies/acme/postings")


def test_empty_or_missing_file_allows_everything() -> None:
    assert Robots("").allows("https://x.example/anything")
    assert Robots("User-agent: *\nDisallow:\n").allows("https://x.example/anything")


@pytest.mark.asyncio
@pytest.mark.parametrize(
    ("status", "allowed"), [(404, True), (410, True), (422, True), (403, True)]
)
async def test_client_error_robots_means_no_rules(status: int, allowed: bool) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(status))
    ) as client:
        robots = await load_robots(client, SourceBoard("acme", "Acme"), "https://x.example")
    assert robots.allows("https://x.example/jobs/1") is allowed


@pytest.mark.asyncio
@pytest.mark.parametrize("status", [429, 500, 503])
async def test_rate_limit_or_server_error_fails_the_board(status: int) -> None:
    async with httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(status))
    ) as client:
        with pytest.raises(BoardFetchError):
            await load_robots(client, SourceBoard("acme", "Acme"), "https://x.example")
