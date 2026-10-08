import pytest

from careeros_api.job_salary import salary_range


@pytest.mark.parametrize(
    ("text", "expected"),
    [
        ("$126,000—$168,000 USD", (126000, 168000, "USD", "YEAR")),
        (
            "The expected base pay range in Toronto is CAD $108,000 - CAD $135,000.",
            (108000, 135000, "CAD", "YEAR"),
        ),
        (
            "Canada: the pay range for this role is $190,500 - $262,000 per year",
            (190500, 262000, "CAD", "YEAR"),
        ),
        ("The target hourly compensation is $40.00 - $60 per hour.", (40, 60, "USD", "HOUR")),
        ("$20.70—$20.70 USD", (20.7, 20.7, "USD", "HOUR")),
        ("Salary: $120K - $150K", (120000, 150000, "USD", "YEAR")),
        (
            "Level 1: $95,000.00 - $125,000.00\nLevel 2: $110,000.00 - $150,000.00",
            (95000, 150000, "USD", "YEAR"),
        ),
    ],
)
def test_explicit_ranges(text: str, expected: tuple[float, float, str, str]) -> None:
    result = salary_range(text)
    assert result is not None
    assert (result.minimum, result.maximum, result.currency, result.period) == expected


@pytest.mark.parametrize(
    "text",
    [
        "Founded in 2017 and now valued at $15 billion.",
        "Consistently meeting sales quotas ($1M+ annually).",
        "A $5.8B valuation and more than $1 billion in annualized bookings.",
        "We raised $200 - $300 million in Series C funding.",
        "Base salary of $150,000.",
        "Build reliable systems with Python.",
    ],
)
def test_non_pay_amounts_are_ignored(text: str) -> None:
    assert salary_range(text) is None


def test_quote_is_the_sentence_with_the_range() -> None:
    result = salary_range("Great team. The salary range is $100,000 - $120,000. Apply now.")
    assert result is not None
    assert result.quote == "The salary range is $100,000 - $120,000"
