"""Question normalization and active-answer lookup shared by the Answer Engine."""

import re
import unicodedata
from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from careeros_api.models import ReusableAnswer

_REQUIRED_MARKERS = re.compile(r"\(required\)|（必填）|\(必填\)|\*", re.I)
_TRAILING_PUNCTUATION = " \t?？:：.。"


def question_key(question: str) -> str:
    """Normalize a question label so the same question matches across forms."""
    text = unicodedata.normalize("NFKC", question)
    text = _REQUIRED_MARKERS.sub(" ", text)
    text = " ".join(text.split()).casefold()
    return text.strip(_TRAILING_PUNCTUATION)


async def active_reusable_answers(
    session: AsyncSession, user_id: UUID, keys: set[str]
) -> dict[str, ReusableAnswer]:
    if not keys:
        return {}
    rows = await session.scalars(
        select(ReusableAnswer).where(
            ReusableAnswer.user_id == user_id,
            ReusableAnswer.revoked_at.is_(None),
            ReusableAnswer.question_key.in_(keys),
        )
    )
    return {row.question_key: row for row in rows}
