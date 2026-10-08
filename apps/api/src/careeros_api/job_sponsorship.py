"""What a job description explicitly says about visa sponsorship.

Deterministic and quote-backed: the result is only ever a statement the
posting itself makes, returned with the sentence that makes it. Nothing is
inferred from company, location, or role, and nothing is said about the user.
Vague mentions (an immigration team's duties, card networks named "Visa")
are deliberately ignored: only explicit offers and refusals are reported.
"""

import re
from typing import Literal

from pydantic import BaseModel

SponsorshipStatus = Literal["OFFERED", "NOT_OFFERED"]

_NEG = (
    r"(?:unable|not\s+able|cannot|can\s?not|can'?t|will\s+not|won'?t|"
    r"do(?:es)?\s+not|do(?:es)?n'?t|are\s+not\s+able)"
)
_NOT_OFFERED = [
    _NEG + r"(?:\s+currently)?\s+(?:to\s+)?(?:provide|offer|support|sponsor)\b[^.]{0,60}"
    r"\b(?:sponsor\w*|visas?)\b",
    _NEG + r"(?:\s+currently)?\s+(?:to\s+)?sponsor\b",
    r"\bno\s+(?:visa\s+|immigration\s+|h-?1b\s+)?sponsorship\b",
    r"\b(?:visa\s+)?sponsorship\s+(?:is\s+)?(?:not|un)\s*available\b",
    r"\bwithout\s+(?:the\s+need\s+for\s+)?(?:current\s+or\s+future\s+|any\s+)?"
    r"(?:visa\s+|employer\s+|immigration\s+)?sponsorship\b",
    r"\bnot\s+(?:eligible|offering|providing)\s+(?:for\s+)?(?:visa\s+)?sponsorship\b",
]
_OFFERED = [
    r"\b(?:visa|h-?1b|immigration)\s+sponsorship\s+(?:is\s+)?(?:available|offered|provided)\b",
    r"\b(?:will|can|do|does|are\s+able\s+to|is\s+able\s+to|happy\s+to|open\s+to)\s+"
    r"(?:provide\s+|offer\s+|support\s+)?(?:visa\s+|h-?1b\s+)?sponsor(?:ship|ing)?\s+"
    r"(?:(?:work\s+|employment\s+)?visas?|h-?1b\w*|for\s+(?:this|the)\s+(?:role|position))\b",
    r"\b(?:visa|h-?1b)\s+sponsorship\s+(?:for\s+[^.]{0,40}\s+)?(?:is\s+)?(?:available|offered)\b",
    r"\bwe\s+(?:do\s+)?sponsor\s+(?:work\s+)?(?:visas?|h-?1b\w*)\b",
]
# Offers must be about immigration, so "we sponsor local hackathons" never
# reads as a visa statement.
_VISA_CONTEXT = r"\b(?:visas?|h-?1b|immigration|work\s+authori[sz]ation)\b"
# U.S. export-control boilerplate talks about licenses "without sponsorship";
# it is not a statement about employment visas.
_EXPORT_CONTROL = r"\bexport\b"
# Split on sentence ends, but not inside abbreviations such as "U.S.".
# Also split "end.Next" where a posting dropped the space after a period.
_SENTENCE_SPLIT = re.compile(
    r"(?<=[.!?;])(?<!\b[A-Z]\.[A-Z]\.)\s+|(?<=[a-z]{2}\.)(?=[A-Z][a-z])|\n+"
)


class SponsorshipStatement(BaseModel):
    status: SponsorshipStatus
    quote: str


def _sentences(text: str) -> list[str]:
    return [
        part.strip()
        for part in _SENTENCE_SPLIT.split(text)
        if part.strip() and not re.search(_EXPORT_CONTROL, part, re.IGNORECASE)
    ]


def _matches(patterns: list[str], sentence: str) -> bool:
    return any(re.search(pattern, sentence, re.IGNORECASE) for pattern in patterns)


def sponsorship_statement(description: str) -> SponsorshipStatement | None:
    """The posting's own sponsorship statement, or None when it makes none.

    A refusal wins over an offer in the same posting, since "cannot sponsor"
    is the fact a candidate most needs to see.
    """
    sentences = _sentences(description)
    for sentence in sentences:
        if _matches(_NOT_OFFERED, sentence):
            return SponsorshipStatement(status="NOT_OFFERED", quote=sentence[:400])
    for sentence in sentences:
        if re.search(_VISA_CONTEXT, sentence, re.IGNORECASE) and _matches(_OFFERED, sentence):
            return SponsorshipStatement(status="OFFERED", quote=sentence[:400])
    return None
