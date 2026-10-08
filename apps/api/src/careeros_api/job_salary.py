"""The pay range a job description states, quoted — never estimated.

Only explicit *ranges* count ("$126,000—$168,000 USD", "CAD $108,000 - CAD
$135,000", "$40.00 - $60 per hour"). Single amounts, valuations, funding,
quotas, and revenue figures are ignored. When a posting lists several ranges
(levels or locations) in one currency and period, the result spans them all.
"""

import re
from typing import Literal

from pydantic import BaseModel

SalaryPeriod = Literal["YEAR", "HOUR"]

# "$120,000", "C$120,000", "CAD $120,000", "USD 120,000", "$120K".
_AMOUNT = (
    r"(?:(?:(?:USD|CAD)\s?)?(?:US|C|CA)?\$|(?:USD|CAD)\s?)\s?"
    r"(\d{1,3}(?:,\d{3})+|\d+)(\.\d{1,2})?\s?([kK])?"
)
_RANGE = re.compile(
    _AMOUNT + r"\s?(?:USD|CAD)?\s?(?:-|–|—|to|and)\s?" + _AMOUNT + r"(?:\s?(USD|CAD))?",
)
_CURRENCY_HINT = re.compile(r"\b(CAD|USD)\b|C\$|CA\$", re.IGNORECASE)
_CANADA = re.compile(r"\b(canada|canadian)\b", re.IGNORECASE)
_HOURLY_HINT = re.compile(r"\b(hour|hourly|/hr|per hr|an hour)\b", re.IGNORECASE)
_NOT_PAY = re.compile(
    r"\b(valuation|valued|billion|raised|funding|series [a-z]|revenue|bookings|arr|"
    r"quota|budget|spend|portfolio|assets under|aum|million in)\b",
    re.IGNORECASE,
)
_SENTENCE_END = re.compile(r"[.!?\n]")


class SalaryRange(BaseModel):
    # Annual amounts are whole currency units; hourly keeps cents.
    minimum: float
    maximum: float
    currency: Literal["USD", "CAD"]
    period: SalaryPeriod
    quote: str


def _value(digits: str, cents: str | None, thousands: str | None) -> float:
    number = float(digits.replace(",", "") + (cents or ""))
    return number * 1000 if thousands else number


def _sentence(text: str, start: int, end: int) -> str:
    left = max((m.end() for m in _SENTENCE_END.finditer(text, 0, start)), default=0)
    right_match = _SENTENCE_END.search(text, end)
    right = right_match.start() if right_match else len(text)
    return " ".join(text[left:right].split())[:300]


def salary_range(description: str) -> SalaryRange | None:
    found: list[tuple[float, float, Literal["USD", "CAD"], SalaryPeriod, str]] = []
    for match in _RANGE.finditer(description):
        low = _value(match.group(1), match.group(2), match.group(3))
        high = _value(match.group(4), match.group(5), match.group(6))
        if low <= 0 or high < low or high > low * 3:
            continue
        sentence = _sentence(description, match.start(), match.end())
        if _NOT_PAY.search(sentence):
            continue
        hint = _CURRENCY_HINT.search(match.group(0)) or _CURRENCY_HINT.search(sentence)
        if hint:
            canadian = hint.group(0).upper().replace("$", "") in {"CAD", "C", "CA"}
        else:
            # "Canada: the pay range is $190,500 - $262,000" is in CAD.
            canadian = bool(_CANADA.search(sentence))
        currency: Literal["USD", "CAD"] = "CAD" if canadian else "USD"
        if high < 1000:
            period: SalaryPeriod = "HOUR"
            if not (10 <= low and high <= 500):
                continue
        else:
            period = "YEAR"
            if not (15_000 <= low and high <= 2_000_000) or _HOURLY_HINT.search(sentence):
                continue
        found.append((low, high, currency, period, sentence))
    if not found:
        return None
    first_currency, first_period = found[0][2], found[0][3]
    same = [item for item in found if item[2] == first_currency and item[3] == first_period]
    low, high = min(item[0] for item in same), max(item[1] for item in same)
    if first_period == "YEAR":
        low, high = float(round(low)), float(round(high))
    return SalaryRange(
        minimum=low,
        maximum=high,
        currency=first_currency,
        period=first_period,
        quote=same[0][4],
    )
