"""Always-open and over-a-year-old postings are not kept as current openings."""

from datetime import UTC, datetime, timedelta

from careeros_api.job_source_boards import (
    BoardMapping,
    SourceBoard,
    build_candidate,
    is_standing_interest_posting,
    without_stale,
)
from careeros_api.models import JobCountry, JobEmploymentType, JobMarket, JobWorkplaceType

NOW = datetime(2026, 10, 10, tzinfo=UTC)
BOARD = SourceBoard("acme", "Acme")


def candidate(job_id: str, posted_days_ago: int | None):  # type: ignore[no-untyped-def]
    posted = NOW - timedelta(days=posted_days_ago) if posted_days_ago is not None else None
    built = build_candidate(
        external_id=f"acme:{job_id}",
        board=BOARD,
        title="Platform Engineer",
        location="Austin, TX",
        description="Build the platform that powers our products.",
        posting_url=f"https://example.com/jobs/{job_id}",
        application_url="",
        placement=(JobMarket.NORTH_AMERICA, JobCountry.US),
        workplace=JobWorkplaceType.UNKNOWN,
        employment=JobEmploymentType.FULL_TIME,
        observed_at=NOW,
        posted_at=posted,
    )
    assert built is not None
    return built


def test_postings_older_than_a_year_are_dropped_and_unseen() -> None:
    mapping = BoardMapping(
        (
            candidate("fresh", 30),
            candidate("half", 300),
            candidate("old", 400),
            candidate("x", None),
        ),
        4,
        0,
        0,
        retained_external_ids=frozenset({"acme:kept"}),
    )
    filtered = without_stale(mapping, NOW)

    assert {c.external_job_id for c in filtered.candidates} == {"acme:fresh", "acme:half", "acme:x"}
    assert "acme:old" not in filtered.seen_external_ids
    assert "acme:kept" in filtered.seen_external_ids
    assert filtered.skipped_not_opening == 1


def test_mapping_without_stale_postings_is_unchanged() -> None:
    mapping = BoardMapping((candidate("fresh", 1),), 1, 0, 0)
    assert without_stale(mapping, NOW) is mapping


def test_evergreen_titles_are_not_openings() -> None:
    assert is_standing_interest_posting("Evergreen - Software Engineer")
    assert not is_standing_interest_posting("Software Engineer, Platform")
