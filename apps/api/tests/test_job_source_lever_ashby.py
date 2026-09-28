"""Lever and Ashby mapping (offline) and catalog ingestion through the shared adapter."""

from datetime import UTC, datetime
from uuid import uuid4

import pytest
from conftest import get_test_db_url
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from careeros_api.job_source_ashby import ASHBY_SOURCE_KEY, map_job_board
from careeros_api.job_source_boards import BoardAdapter, BoardFetchError, SourceBoard
from careeros_api.job_source_lever import LEVER_SOURCE_KEY, map_postings
from careeros_api.job_sources import ingest_job_source, mark_unseen_catalog_jobs_unavailable
from careeros_api.models import Job

MOMENT = datetime(2026, 9, 28, tzinfo=UTC)


def lever_posting(posting_id: str, country: str | None, **overrides):  # type: ignore[no-untyped-def]
    posting = {
        "id": posting_id,
        "text": "Platform Engineer",
        "country": country,
        "workplaceType": "hybrid",
        "categories": {
            "commitment": "Full-time",
            "location": "New York, NY",
            "allLocations": ["New York, NY"],
        },
        "description": "<div>Build the platform that powers our products.</div>",
        "lists": [{"text": "What you'll do", "content": "<li>Own reliable services</li>"}],
        "additional": "<div>We sponsor learning.</div>",
        "hostedUrl": f"https://jobs.lever.co/acme/{posting_id}",
        "applyUrl": f"https://jobs.lever.co/acme/{posting_id}/apply",
    }
    posting.update(overrides)
    return posting


def ashby_job(job_id: str, location: str, country: str | None, **overrides):  # type: ignore[no-untyped-def]
    job = {
        "id": job_id,
        "title": "Research Engineer",
        "location": location,
        "address": (
            {"postalAddress": {"addressCountry": country}} if country is not None else None
        ),
        "secondaryLocations": [],
        "employmentType": "FullTime",
        "workplaceType": "OnSite",
        "isListed": True,
        "isRemote": False,
        "descriptionHtml": "<h1>About</h1><p>Train and evaluate large models safely.</p>",
        "jobUrl": f"https://jobs.ashbyhq.com/acme/{job_id}",
        "applyUrl": f"https://jobs.ashbyhq.com/acme/{job_id}/application",
    }
    job.update(overrides)
    return job


def test_lever_uses_explicit_country_and_structured_fields() -> None:
    board = SourceBoard("acme", "Acme")
    mapping = map_postings(
        [
            lever_posting("a1", "US"),
            lever_posting("a2", "SG"),
            lever_posting(
                "a3",
                None,
                categories={
                    "commitment": "Intern",
                    "location": "Toronto",
                    "allLocations": ["Toronto"],
                },
            ),
            {"id": 7},
        ],
        board,
        MOMENT,
    )
    assert mapping.seen_external_ids == {"acme:a1", "acme:a3"}
    assert mapping.fetched == 3
    assert (mapping.skipped_outside_market, mapping.skipped_invalid) == (1, 1)
    us, toronto = mapping.candidates
    assert us.country_code.value == "US"
    assert us.workplace_type.value == "HYBRID"
    assert us.employment_type.value == "FULL_TIME"
    assert str(us.application_url) == "https://jobs.lever.co/acme/a1/apply"
    assert "What you'll do\n\n- Own reliable services" in us.description
    assert toronto.country_code.value == "CA"
    assert toronto.employment_type.value == "INTERNSHIP"
    with pytest.raises(BoardFetchError):
        map_postings({"jobs": []}, board)


def test_ashby_resolves_each_location_and_skips_unlisted() -> None:
    board = SourceBoard("acme", "Acme")
    mapping = map_job_board(
        {
            "jobs": [
                ashby_job("b1", "San Francisco", "United States"),
                ashby_job("b2", "London", "United Kingdom"),
                ashby_job(
                    "b3",
                    "Canada",
                    None,
                    secondaryLocations=[
                        {
                            "location": "Remote (US)",
                            "address": {"postalAddress": {"addressCountry": "United States"}},
                        }
                    ],
                    workplaceType=None,
                    isRemote=True,
                ),
                ashby_job("b4", "New York", "United States", isListed=False),
            ]
        },
        board,
        MOMENT,
    )
    # Unlisted and out-of-market postings are not kept, so a sync closes them.
    assert mapping.seen_external_ids == {"acme:b1", "acme:b3"}
    assert mapping.skipped_outside_market == 1
    sf, both = mapping.candidates
    assert sf.country_code.value == "US"
    assert sf.workplace_type.value == "ONSITE"
    assert both.country_code.value == "UNKNOWN"
    assert both.market.value == "NORTH_AMERICA"
    assert both.location == "Canada · Remote (US)"
    assert both.workplace_type.value == "REMOTE"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_lever_and_ashby_ingest_into_catalog_independently() -> None:
    token = f"test-{uuid4().hex[:12]}"
    board = SourceBoard(token, "Acme")
    engine = create_async_engine(get_test_db_url())
    factory = async_sessionmaker(engine, expire_on_commit=False)
    try:
        async with factory() as session:
            lever = map_postings([lever_posting(f"{token}-1", "US")], board, MOMENT)
            ashby = map_job_board(
                {"jobs": [ashby_job(f"{token}-2", "Austin", "United States")]}, board, MOMENT
            )
            for key, mapping in ((LEVER_SOURCE_KEY, lever), (ASHBY_SOURCE_KEY, ashby)):
                result = await ingest_job_source(
                    session,
                    user_id=None,
                    adapter=BoardAdapter(key, mapping),
                    parser=None,
                    defer_requirements=True,
                )
                assert result.created_count == 1
                assert result.jobs[0].source_key == key
            # Closing one source's board never touches another source's jobs.
            closed = await mark_unseen_catalog_jobs_unavailable(
                session,
                source_key=LEVER_SOURCE_KEY,
                external_id_prefix=board.external_id_prefix,
                seen_external_ids=set(),
            )
            assert closed == 1
            await session.commit()
    finally:
        async with factory() as session:
            await session.execute(
                delete(Job).where(Job.user_id.is_(None), Job.external_job_id.like(f"{token}:%"))
            )
            await session.commit()
        await engine.dispose()
