"""iCIMS career portals (North America), via sitemap + schema.org JSON-LD.

An iCIMS portal (``https://careers-{company}.icims.com``) advertises a
``sitemap.xml`` listing every open job as ``/jobs/{id}/{slug}/job``. The job
page frames its content; the framed view (``?in_iframe=1``) carries a
schema.org ``JobPosting`` with ``validThrough``. Only paths ``robots.txt``
allows are read. See ``docs/JOB_SOURCE_DECISION.md``.

The sitemap is treated as complete, so a posting absent from it is closed.
"""

import asyncio
import dataclasses
import re
from collections.abc import Mapping
from datetime import UTC, datetime, timedelta

import httpx

from careeros_api.job_source_boards import (
    BoardAdapter,
    BoardFetchError,
    BoardMapping,
    SourceBoard,
    fetch_page,
    json_ld_job_posting,
    load_robots,
    read_listed_pages,
    sitemap_urls,
)
from careeros_api.job_source_careersite import (
    CareerSiteFetch,
    map_site,
    posting_from_json_ld,
)

ICIMS_SOURCE_KEY = "icims"
PAUSE_BETWEEN_PAGES_SECONDS = 1.0
MAX_NEW_PAGES_PER_RUN = 1500
MAX_RECHECKS_PER_RUN = 25

_SITE = re.compile(r"^https://[a-z0-9-]+\.icims\.com$")
_JOB = re.compile(r"^(https://[a-z0-9-]+\.icims\.com/jobs/(\d+)/[^/?#]+/job)$")
_FRAMED = "?in_iframe=1"
# iCIMS fills ``datePosted`` with "two years before now" when a portal hides
# the real date; treat that placeholder as unknown.
_PLACEHOLDER_AGE = timedelta(days=730)
_PLACEHOLDER_SLACK = timedelta(days=2)


def _real_posted(posted: datetime | None, moment: datetime) -> datetime | None:
    if posted is not None and abs((moment - posted) - _PLACEHOLDER_AGE) <= _PLACEHOLDER_SLACK:
        return None
    return posted


def _site(board: SourceBoard) -> str:
    if not board.site_url or not _SITE.match(board.site_url):
        raise BoardFetchError(f"{board.token}: missing or invalid iCIMS site_url")
    return board.site_url


async def fetch_site(
    client: httpx.AsyncClient,
    board: SourceBoard,
    known: Mapping[str, str],
    *,
    pause: float = PAUSE_BETWEEN_PAGES_SECONDS,
    max_new_pages: int = MAX_NEW_PAGES_PER_RUN,
    max_rechecks: int = MAX_RECHECKS_PER_RUN,
) -> CareerSiteFetch:
    """Read one portal. ``known`` maps already-open catalog ids to their URLs."""
    site = _site(board)
    sitemap = f"{site}/sitemap.xml"
    robots = await load_robots(client, board, site)
    if not robots.allows(sitemap) or not robots.allows(f"{site}/jobs/1/x/job{_FRAMED}"):
        raise BoardFetchError(f"{board.token}: robots.txt disallows the sitemap or job pages")

    await asyncio.sleep(pause)
    response = await fetch_page(client, board, sitemap)
    if response.status_code != 200:
        raise BoardFetchError(f"{board.token}: sitemap HTTP {response.status_code}")
    # Fetch the framed view; record the plain page as the posting URL.
    listed: dict[str, str] = {}
    for url in sitemap_urls(response.text, board.token):
        match = _JOB.match(url)
        if match:
            listed.setdefault(f"{board.external_id_prefix}{match.group(2)}", url + _FRAMED)
    read = await read_listed_pages(
        client,
        board,
        robots,
        listed,
        known,
        complete=True,
        extract=json_ld_job_posting,
        worth_fetching=lambda url: True,
        pause=pause,
        max_new_pages=max_new_pages,
        max_rechecks=max_rechecks,
    )
    moment = datetime.now(UTC)
    postings = []
    for external_id, (url, raw) in read.pages.items():
        posting = posting_from_json_ld(external_id, url.removesuffix(_FRAMED), raw, moment)
        postings.append(dataclasses.replace(posting, posted=_real_posted(posting.posted, moment)))
    return CareerSiteFetch(tuple(postings), read.retained, read.skipped_outside_market)


map_portal = map_site


class IcimsBoardAdapter(BoardAdapter):
    def __init__(self, mapping: BoardMapping) -> None:
        super().__init__(ICIMS_SOURCE_KEY, mapping)
