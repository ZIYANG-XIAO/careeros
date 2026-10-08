"""Publish dates from sources, recency ordering, diversified and grouped listings."""

from datetime import UTC, datetime

import pytest
from conftest import get_test_db_url, make_integration_client
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from test_job_source_greenhouse import board_token, posting
from test_job_source_lever_ashby import ashby_job, lever_posting

from careeros_api.job_source_ashby import map_job_board
from careeros_api.job_source_boards import SourceBoard, posted_moment
from careeros_api.job_source_greenhouse import (
    GreenhouseBoard,
    GreenhouseBoardAdapter,
    map_board_jobs,
)
from careeros_api.job_source_lever import map_postings
from careeros_api.job_sources import ingest_job_source
from careeros_api.models import Job

SYNC = datetime(2026, 10, 2, tzinfo=UTC)


def test_posted_moment_accepts_iso_and_epoch_and_rejects_nonsense() -> None:
    assert posted_moment("2026-06-11T12:42:45-04:00", SYNC) == datetime(
        2026, 6, 11, 16, 42, 45, tzinfo=UTC
    )
    assert posted_moment(1786469891368, SYNC) == datetime.fromtimestamp(1786469891.368, tz=UTC)
    assert posted_moment("2021-04-27T20:13:45.158Z", SYNC) is not None
    for bad in (None, "", "yesterday", True, "2026-06-11T12:00:00", "1999-01-01T00:00:00Z"):
        assert posted_moment(bad, SYNC) is None
    # A date well after the sync is a source error, not a fact.
    assert posted_moment("2027-01-01T00:00:00Z", SYNC) is None


def test_each_adapter_reads_its_publish_field() -> None:
    board = SourceBoard("acme", "Acme")
    greenhouse = map_board_jobs(
        {"jobs": [{**posting(1, "Austin, TX"), "first_published": "2026-09-01T10:00:00Z"}]},
        GreenhouseBoard("acme", "Acme"),
        observed_at=SYNC,
    )
    lever = map_postings(
        [lever_posting("a1", "US", createdAt=1788300000000)], board, observed_at=SYNC
    )
    ashby = map_job_board(
        {
            "jobs": [
                ashby_job(
                    "b1", "San Francisco", "United States", publishedAt="2026-09-20T08:00:00Z"
                )
            ]
        },
        board,
        observed_at=SYNC,
    )
    assert greenhouse.candidates[0].posted_at == datetime(2026, 9, 1, 10, tzinfo=UTC)
    assert lever.candidates[0].posted_at == datetime.fromtimestamp(1788300000, tz=UTC)
    assert ashby.candidates[0].posted_at == datetime(2026, 9, 20, 8, tzinfo=UTC)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_recent_is_by_publish_date_and_diversify_caps_each_company() -> None:
    token = board_token()
    alpha, beta = f"Alpha {token}", f"Beta {token}"
    engine = create_async_engine(get_test_db_url())
    factory = async_sessionmaker(engine, expire_on_commit=False)

    def gh(job_id: int, title: str, published: str) -> dict[str, object]:
        return {**posting(job_id, "Austin, TX", title=title), "first_published": published}

    try:
        async with factory() as session:
            for company, jobs in (
                (
                    alpha,
                    [
                        gh(1, "Alpha One", "2026-09-01T00:00:00Z"),
                        gh(2, "Alpha Two", "2026-09-05T00:00:00Z"),
                        gh(3, "Alpha Three", "2026-09-03T00:00:00Z"),
                    ],
                ),
                (beta, [gh(4, "Beta One", "2026-09-04T00:00:00Z")]),
            ):
                mapping = map_board_jobs({"jobs": jobs}, GreenhouseBoard(token, company))
                await ingest_job_source(
                    session,
                    user_id=None,
                    adapter=GreenhouseBoardAdapter(mapping),
                    parser=None,
                    defer_requirements=True,
                )
            await session.commit()

        async with make_integration_client() as client:
            base = {"search": token, "source": "catalog", "collapse": True}
            recent = (await client.get("/jobs", params=base)).json()
            assert [job["title"] for job in recent] == [
                "Alpha Two",
                "Beta One",
                "Alpha Three",
                "Alpha One",
            ]
            assert recent[0]["posted_at"].startswith("2026-09-05")

            mixed = (await client.get("/jobs", params={**base, "diversify": True})).json()
            assert [job["title"] for job in mixed] == ["Alpha Two", "Beta One", "Alpha Three"]
            by_title = {job["title"]: job for job in mixed}
            assert by_title["Alpha Three"]["company_rank"] == 2
            assert by_title["Alpha Three"]["company_job_count"] == 3
            assert by_title["Beta One"]["company_job_count"] == 1

            one_company = (
                await client.get("/jobs", params={"company": alpha.upper(), "source": "catalog"})
            ).json()
            assert len(one_company) == 3

    finally:
        async with factory() as session:
            await session.execute(
                delete(Job).where(Job.user_id.is_(None), Job.external_job_id.like(f"{token}:%"))
            )
            await session.commit()
        await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_match_sort_ranks_by_the_active_goal_then_recency() -> None:
    token = board_token()
    engine = create_async_engine(get_test_db_url())
    factory = async_sessionmaker(engine, expire_on_commit=False)

    def gh(job_id: int, title: str, location: str, published: str) -> dict[str, object]:
        return {**posting(job_id, location, title=title), "first_published": published}

    try:
        async with factory() as session:
            for company, jobs in (
                (
                    f"Gamma {token}",
                    [
                        # Newest, but neither role nor city matches.
                        gh(1, "Account Executive", "Austin, TX", "2026-09-30T00:00:00Z"),
                        # Role and city match.
                        gh(2, "Senior Backend Engineer", "Toronto, ON", "2026-09-02T00:00:00Z"),
                    ],
                ),
                (
                    f"Blocked {token}",
                    [gh(3, "Backend Engineer", "Toronto, ON", "2026-09-29T00:00:00Z")],
                ),
                (
                    f"Delta {token}",
                    # Role matches only.
                    [gh(4, "Backend Engineer, Payments", "Austin, TX", "2026-09-10T00:00:00Z")],
                ),
            ):
                mapping = map_board_jobs({"jobs": jobs}, GreenhouseBoard(token, company))
                await ingest_job_source(
                    session,
                    user_id=None,
                    adapter=GreenhouseBoardAdapter(mapping),
                    parser=None,
                    defer_requirements=True,
                )
            await session.commit()

        async with make_integration_client() as client:
            params = {"search": token, "source": "catalog", "sort": "match"}
            # Without a goal, "match" is plain recency.
            no_goal = (await client.get("/jobs", params=params)).json()
            assert no_goal[0]["title"] == "Account Executive"

            await client.post(
                "/job-search-goals",
                json={
                    "name": "Toronto backend",
                    "market": "NORTH_AMERICA",
                    "country_codes": [],
                    "target_roles": ["Backend Engineer"],
                    "cities": ["Toronto"],
                    "workplace_types": [],
                    "employment_types": [],
                    "company_blocklist": [f"blocked {token}"],
                },
            )
            ranked = (await client.get("/jobs", params={**params, "diversify": True})).json()
            assert [job["title"] for job in ranked] == [
                "Senior Backend Engineer",
                "Backend Engineer, Payments",
                "Account Executive",
                "Backend Engineer",
            ]
    finally:
        async with factory() as session:
            await session.execute(
                delete(Job).where(Job.user_id.is_(None), Job.external_job_id.like(f"{token}:%"))
            )
            await session.commit()
        await engine.dispose()
