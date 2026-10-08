import pytest

from careeros_api.job_sponsorship import sponsorship_statement


@pytest.mark.parametrize(
    "text",
    [
        "We are unable to sponsor visas for this role.",
        "Applicants must be authorized to work in the U.S. without the need for "
        "current or future sponsorship.",
        "No visa sponsorship is available.",
        "Sponsorship is not available for this position.",
        "The company will not provide H-1B sponsorship.",
        "We do not sponsor work visas.",
        "Harvey does not currently offer visa sponsorship for this role",
        "please note we don't sponsor work visa or relocations",
    ],
)
def test_explicit_refusals(text: str) -> None:
    result = sponsorship_statement(f"Build APIs.\n{text}\nGreat benefits.")
    assert result is not None
    assert result.status == "NOT_OFFERED"
    assert result.quote == text


@pytest.mark.parametrize(
    "text",
    [
        "Visa sponsorship is available for exceptional candidates.",
        "We will sponsor H-1B transfers.",
        "We are open to sponsoring visas.",
        "Visa sponsorship: We do sponsor visas!",
    ],
)
def test_explicit_offers(text: str) -> None:
    result = sponsorship_statement(text)
    assert result is not None
    assert result.status == "OFFERED"


def test_refusal_wins_over_offer_in_the_same_posting() -> None:
    result = sponsorship_statement(
        "Sponsorship is available for senior roles. We cannot sponsor interns."
    )
    assert result is not None
    assert result.status == "NOT_OFFERED"
    assert result.quote == "We cannot sponsor interns."


@pytest.mark.parametrize(
    "text",
    [
        "Please indicate whether you require sponsorship.",
        "Shape our immigration strategy, including what we sponsor and how.",
        "Familiarity with card network protocols or BIN sponsorship (Visa, Mastercard).",
    ],
)
def test_vague_mentions_are_not_statements(text: str) -> None:
    assert sponsorship_statement(text) is None


def test_silence_is_not_a_statement() -> None:
    assert sponsorship_statement("Build reliable systems with Python and Kafka.") is None
    # Sponsoring events is not an immigration statement at all.
    assert sponsorship_statement("We sponsor local hackathons and meetups.") is None


def test_export_control_boilerplate_is_not_a_visa_statement() -> None:
    text = (
        "Any offer may be conditioned on your authorization to receive technology "
        "controlled under U.S. export laws without sponsorship for an export license."
    )
    assert sponsorship_statement(text) is None


def test_event_sponsorship_is_not_a_visa_mention() -> None:
    assert sponsorship_statement("Identify sponsorship opportunities for events.") is None


def test_missing_space_after_period_still_isolates_the_statement() -> None:
    result = sponsorship_statement(
        "Interviews are in English.Toast will not sponsor applicants for work visas."
    )
    assert result is not None
    assert result.quote == "Toast will not sponsor applicants for work visas."
