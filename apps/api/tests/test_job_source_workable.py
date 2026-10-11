"""Workable widget mapping (offline)."""

from datetime import UTC, datetime

import pytest

from careeros_api.job_source_boards import BoardFetchError, SourceBoard
from careeros_api.job_source_workable import map_account
from careeros_api.models import JobCountry, JobEmploymentType, JobMarket, JobWorkplaceType

BOARD = SourceBoard("acme", "Acme")
MOMENT = datetime(2026, 10, 10, tzinfo=UTC)


def job(shortcode: str, *locations: dict[str, str], **overrides: object) -> dict[str, object]:
    raw: dict[str, object] = {
        "title": "Data Scientist",
        "shortcode": shortcode,
        "employment_type": "Full-time",
        "telecommuting": False,
        "url": f"https://apply.workable.com/j/{shortcode}",
        "application_url": f"https://apply.workable.com/j/{shortcode}/apply",
        "published_on": "2026-09-01",
        "country": "",
        "city": "",
        "state": "",
        "locations": list(locations),
        "description": "<p>Model the data that drives our decisions.</p>",
    }
    raw.update(overrides)
    return raw


US = {"country": "United States", "countryCode": "US", "city": "Santa Monica", "region": "CA"}
CA = {"country": "Canada", "countryCode": "CA", "city": "Toronto", "region": "ON"}
UK = {"country": "United Kingdom", "countryCode": "GB", "city": "London", "region": ""}


def test_maps_a_us_job() -> None:
    mapping = map_account({"name": "Acme", "jobs": [job("AB12", US)]}, BOARD, MOMENT)

    (candidate,) = mapping.candidates
    assert candidate.external_job_id == "acme:AB12"
    assert candidate.company == "Acme"
    assert candidate.location == "Santa Monica, CA, United States"
    assert candidate.market == JobMarket.NORTH_AMERICA
    assert candidate.country_code == JobCountry.US
    assert candidate.employment_type == JobEmploymentType.FULL_TIME
    assert candidate.posted_at == datetime(2026, 9, 1, tzinfo=UTC)
    assert str(candidate.application_url) == "https://apply.workable.com/j/AB12/apply"
    assert candidate.description == "Model the data that drives our decisions."


def test_us_and_canada_is_north_america_with_unknown_country() -> None:
    mapping = map_account({"jobs": [job("AB13", US, CA)]}, BOARD, MOMENT)
    assert mapping.candidates[0].country_code == JobCountry.UNKNOWN


def test_jobs_outside_north_america_are_skipped() -> None:
    mapping = map_account({"jobs": [job("AB14", UK)]}, BOARD, MOMENT)
    assert mapping.candidates == ()
    assert mapping.skipped_outside_market == 1
    assert mapping.seen_external_ids == frozenset()


def test_falls_back_to_top_level_location_fields() -> None:
    raw = job("AB15", country="United States", city="Austin", state="Texas")
    mapping = map_account({"jobs": [raw]}, BOARD, MOMENT)
    assert mapping.candidates[0].country_code == JobCountry.US


def test_remote_and_internship() -> None:
    raw = job("AB16", US, telecommuting=True, employment_type="Internship")
    (candidate,) = map_account({"jobs": [raw]}, BOARD, MOMENT).candidates
    assert candidate.workplace_type == JobWorkplaceType.REMOTE
    assert candidate.employment_type == JobEmploymentType.INTERNSHIP


def test_unexpected_payload_fails_the_board() -> None:
    with pytest.raises(BoardFetchError):
        map_account({"error": "not found"}, BOARD, MOMENT)
