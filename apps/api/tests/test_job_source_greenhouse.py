"""Greenhouse mapping (offline) and the shared catalog it feeds."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from conftest import get_test_db_url, make_integration_client
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine
from test_job_sources import CountingJobParser

from careeros_api.job_source_greenhouse import (
    GreenhouseBoard,
    GreenhouseBoardAdapter,
    GreenhouseFetchError,
    description_text,
    map_board_jobs,
    resolve_north_america,
)
from careeros_api.job_sources import ingest_job_source, mark_unseen_catalog_jobs_unavailable
from careeros_api.models import Job, JobCountry, JobMarket

CONTENT = (
    "&lt;h2&gt;About the role&lt;/h2&gt;&lt;p&gt;Build payment APIs.&lt;/p&gt;"
    "&lt;ul&gt;&lt;li&gt;Python experience required&lt;/li&gt;&lt;/ul&gt;"
)


def posting(job_id: int, location: str, *, title: str = "Backend Engineer", offices=None):  # type: ignore[no-untyped-def]
    return {
        "id": job_id,
        "title": title,
        "absolute_url": f"https://boards.greenhouse.io/acme/jobs/{job_id}?gh_src=feed",
        "location": {"name": location},
        "offices": offices or [],
        "content": CONTENT,
    }


def board_token() -> str:
    # Unique per test run so catalog rows never collide with other tests.
    return f"test-{uuid4().hex[:12]}"


def test_description_text_unescapes_and_structures_html() -> None:
    assert description_text(CONTENT) == (
        "About the role\n\nBuild payment APIs.\n\n- Python experience required"
    )


@pytest.mark.parametrize(
    ("texts", "expected"),
    [
        (["San Francisco, CA"], (JobMarket.NORTH_AMERICA, JobCountry.US)),
        (["Toronto"], (JobMarket.NORTH_AMERICA, JobCountry.CA)),
        (["Remote - US"], (JobMarket.NORTH_AMERICA, JobCountry.US)),
        (["Seattle, WA • Vancouver, BC"], (JobMarket.NORTH_AMERICA, JobCountry.UNKNOWN)),
        (["Berlin, DE"], None),
        (["London, UK"], None),
        (["Remote"], None),
        (["Bellevue, Washington"], (JobMarket.NORTH_AMERICA, JobCountry.US)),
        (["Ontario - Remote"], (JobMarket.NORTH_AMERICA, JobCountry.CA)),
        (["North America"], (JobMarket.NORTH_AMERICA, JobCountry.UNKNOWN)),
        (["Hybrid - San Francisco, London, Berlin"], (JobMarket.NORTH_AMERICA, JobCountry.US)),
        (["Remote - United Kingdom"], None),
        (["Greece"], None),
    ],
)
def test_resolve_north_america_is_explicit_only(texts, expected) -> None:  # type: ignore[no-untyped-def]
    assert resolve_north_america(texts) == expected


def test_office_fallback_only_for_placeless_locations_and_no_talent_pools() -> None:
    board = GreenhouseBoard("acme", "Acme")
    us_office = [{"name": "US"}]
    mapping = map_board_jobs(
        {
            "jobs": [
                posting(1, "Hybrid", offices=us_office),
                posting(2, "Greece", offices=us_office),
                posting(3, "Remote - United Kingdom", offices=us_office),
                posting(4, "New York, NY", title="Future Opportunities: Sales"),
                posting(5, "Austin, TX", title="Engineer - Join Our Talent Community"),
            ]
        },
        board,
    )
    assert mapping.seen_external_ids == {"acme:1"}
    assert (mapping.skipped_outside_market, mapping.skipped_not_opening) == (2, 2)


def test_map_board_jobs_keeps_north_america_and_tracks_every_posting() -> None:
    board = GreenhouseBoard("acme", "Acme")
    mapping = map_board_jobs(
        {
            "jobs": [
                posting(1, "San Francisco, CA"),
                posting(2, "Berlin, Germany"),
                posting(3, "N/A", offices=[{"name": "Canada Locations"}]),
                posting(4, "New York, NY", title="Software Engineering Intern"),
                {"id": "not-an-int"},
            ]
        },
        board,
        observed_at=datetime(2026, 9, 28, tzinfo=UTC),
    )
    # Only kept postings count as seen, so anything else is closed by a sync.
    assert mapping.seen_external_ids == {"acme:1", "acme:3", "acme:4"}
    assert mapping.fetched == 4
    assert mapping.skipped_outside_market == 1
    assert mapping.skipped_invalid == 1
    first, canada, intern = mapping.candidates
    assert first.external_job_id == "acme:1"
    assert first.company == "Acme"
    assert str(first.canonical_url) == "https://boards.greenhouse.io/acme/jobs/1"
    assert first.country_code == JobCountry.US
    assert canada.country_code == JobCountry.CA
    assert intern.employment_type.value == "INTERNSHIP"
    with pytest.raises(GreenhouseFetchError):
        map_board_jobs({"unexpected": True}, board)


@pytest.mark.integration
@pytest.mark.asyncio
async def test_catalog_sync_is_shared_deferred_and_closes_vanished_postings() -> None:
    token = board_token()
    board = GreenhouseBoard(token, "Acme")
    parser = CountingJobParser()
    engine = create_async_engine(get_test_db_url())
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session:
            first = map_board_jobs(
                {"jobs": [posting(1, "Austin, TX"), posting(2, "Boston, MA")]}, board
            )
            result = await ingest_job_source(
                session,
                user_id=None,
                adapter=GreenhouseBoardAdapter(first),
                parser=None,
                defer_requirements=True,
            )
            await session.commit()
            assert result.created_count == 2
            assert parser.calls == 0
            assert all(job.user_id is None for job in result.jobs)
            assert all(job.snapshots[0].requirements_status == "PENDING" for job in result.jobs)

        # Two different users both see the catalog jobs.
        async with make_integration_client(job_parser=parser) as alice:
            listed = await alice.get("/jobs", params={"source": "catalog", "search": "Backend"})
            ours = [job for job in listed.json() if job["company"] == "Acme"]
            assert len(ours) >= 2 and all(job["is_catalog"] for job in ours)
            job_id = next(job["id"] for job in ours if job["canonical_url"].endswith("/jobs/1"))
            # Catalog jobs are read-only for everyone.
            assert (await alice.patch(f"/jobs/{job_id}", json={"title": "X"})).status_code == 404
            assert (await alice.delete(f"/jobs/{job_id}")).status_code == 404
            assert (await alice.post(f"/jobs/{job_id}/save")).status_code == 200

            # First use extracts requirements once; the second user reuses them.
            extracted = await alice.post(f"/jobs/{job_id}/requirements")
            assert extracted.status_code == 200, extracted.text
            assert extracted.json()["latest_snapshot"]["requirements_status"] == "PARSED"
            assert parser.calls == 1
            async with make_integration_client(
                user_id=uuid4(), brain_id=uuid4(), job_parser=parser
            ) as bob:
                again = await bob.post(f"/jobs/{job_id}/requirements")
                assert again.json()["latest_snapshot"]["requirements"]
                assert parser.calls == 1
                assert (await bob.get(f"/jobs/{job_id}")).json()["is_saved"] is False

            # The feed drops posting 1: it closes but stays visible where saved.
            async with factory() as session:
                second = map_board_jobs({"jobs": [posting(2, "Boston, MA")]}, board)
                await ingest_job_source(
                    session,
                    user_id=None,
                    adapter=GreenhouseBoardAdapter(second),
                    parser=None,
                    defer_requirements=True,
                )
                closed = await mark_unseen_catalog_jobs_unavailable(
                    session,
                    source_key="greenhouse",
                    external_id_prefix=board.external_id_prefix,
                    seen_external_ids=set(second.seen_external_ids),
                )
                await session.commit()
                assert closed == 1
            saved = (await alice.get("/jobs", params={"saved_only": True})).json()
            assert any(
                job["id"] == job_id and job["availability_status"] == "UNAVAILABLE" for job in saved
            )
            async with make_integration_client(user_id=uuid4(), brain_id=uuid4()) as carol:
                visible = (
                    await carol.get("/jobs", params={"source": "catalog", "search": "Backend"})
                ).json()
                assert job_id not in {job["id"] for job in visible}

            # Clipping the same page links to the catalog job instead of copying it.
            clip = await alice.post(
                "/jobs/clip",
                json={
                    "company": "Acme",
                    "title": "Backend Engineer",
                    "description": "Build payment APIs. Python experience required.",
                    "source_url": "https://boards.greenhouse.io/acme/jobs/2?utm_source=x",
                },
            )
            assert clip.status_code == 200, clip.text
            assert clip.json()["job"]["is_catalog"] is True
    finally:
        async with factory() as session:
            await session.execute(
                delete(Job).where(Job.user_id.is_(None), Job.external_job_id.like(f"{token}:%"))
            )
            await session.commit()
        await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_jobs_list_paginates() -> None:
    async with make_integration_client() as client:
        page = await client.get("/jobs", params={"limit": 1, "offset": 0, "source": "all"})
        assert page.status_code == 200
        assert len(page.json()) <= 1
        assert (await client.get("/jobs", params={"limit": 500})).status_code == 422
        compact = await client.get("/jobs", params={"limit": 5, "compact": True})
        assert all(
            job["latest_snapshot"]["raw_description"] == ""
            and job["latest_snapshot"]["requirements"] == []
            for job in compact.json()
        )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_collapsed_listing_groups_same_company_and_title() -> None:
    token = board_token()
    board = GreenhouseBoard(token, "Acme")
    engine = create_async_engine(get_test_db_url())
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session:
            mapping = map_board_jobs(
                {
                    "jobs": [
                        posting(1, "Austin, TX", title="Backend Engineer"),
                        posting(2, "Boston, MA", title="Backend Engineer"),
                        posting(3, "New York, NY", title="backend engineer"),
                        posting(4, "San Francisco, CA", title="Frontend Engineer"),
                    ]
                },
                board,
            )
            await ingest_job_source(
                session,
                user_id=None,
                adapter=GreenhouseBoardAdapter(mapping),
                parser=None,
                defer_requirements=True,
            )
            await session.commit()

        async with make_integration_client() as client:
            uncollapsed = await client.get(
                "/jobs", params={"search": "Acme", "source": "catalog", "collapse": False}
            )
            ours = [job for job in uncollapsed.json() if job["company"] == "Acme"]
            assert len(ours) == 4

            collapsed = await client.get(
                "/jobs", params={"search": "Acme", "source": "catalog", "collapse": True}
            )
            ours = sorted(
                (job for job in collapsed.json() if job["company"] == "Acme"),
                key=lambda job: job["title"].lower(),
            )
            assert len(ours) == 2
            backend = next(job for job in ours if job["title"].lower() == "backend engineer")
            frontend = next(job for job in ours if job["title"] == "Frontend Engineer")
            assert backend["similar_count"] == 2
            assert set(backend["other_locations"]) <= {
                "Austin, TX",
                "Boston, MA",
                "New York, NY",
            }
            assert len(backend["other_locations"]) == 2
            assert frontend["similar_count"] == 0
            assert frontend["other_locations"] == []

            # Saving a non-default location in the group promotes it to the
            # representative row.
            other_id = next(
                job["id"]
                for job in uncollapsed.json()
                if job["company"] == "Acme"
                and job["title"] == "Backend Engineer"
                and job["location"] == "Boston, MA"
            )
            saved = await client.post(f"/jobs/{other_id}/save")
            assert saved.status_code == 200
            collapsed_again = await client.get(
                "/jobs", params={"search": "Acme", "source": "catalog", "collapse": True}
            )
            promoted = next(
                job
                for job in collapsed_again.json()
                if job["company"] == "Acme" and job["title"].lower() == "backend engineer"
            )
            assert promoted["location"] == "Boston, MA"
            assert promoted["is_saved"] is True
    finally:
        async with factory() as session:
            await session.execute(
                delete(Job).where(Job.user_id.is_(None), Job.external_job_id.like(f"{token}:%"))
            )
            await session.commit()
        await engine.dispose()
