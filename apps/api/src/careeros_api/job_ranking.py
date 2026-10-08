"""Deterministic ranking of jobs against the user's active Job Search Goal.

Mirrors the Web's Preference Fit (``apps/web/src/lib/preference-fit.ts``): a
criterion counts only when the goal states a preference *and* the job states
a value; each met criterion adds 2, each unmet one subtracts 1, and anything
unknown is ignored rather than guessed. Blocklisted companies sink to the
bottom. The score orders a listing; it is never shown as a number.
"""

import re

from sqlalchemy import Integer, and_, case, false, func, literal, or_
from sqlalchemy.sql.elements import ColumnElement

from careeros_api.models import Job, JobSearchGoal

BLOCKED_SCORE = -1000
_WORD = re.compile(r"[^\w+#]+", re.UNICODE)


def _like(term: str) -> str:
    escaped = term.replace("\\", "\\\\").replace("%", "\\%").replace("_", "\\_")
    return f"%{escaped}%"


def _role_matches(role: str) -> ColumnElement[bool]:
    """Every word of the role appears in the title (or the whole role does)."""
    words = [word for word in _WORD.split(role.strip()) if word]
    whole = Job.title.ilike(_like(role.strip()), escape="\\")
    if not words:
        return whole
    return or_(whole, and_(*[Job.title.ilike(_like(word), escape="\\") for word in words]))


def _judge(stated: ColumnElement[bool], met: ColumnElement[bool]) -> ColumnElement[int]:
    return case((and_(stated, met), 2), (stated, -1), else_=0)


def goal_match_score(goal: JobSearchGoal) -> ColumnElement[int]:
    parts: list[ColumnElement[int]] = []
    if goal.market != "UNKNOWN":
        parts.append(_judge(Job.market != "UNKNOWN", Job.market == goal.market))
    if goal.country_codes:
        parts.append(
            _judge(Job.country_code != "UNKNOWN", Job.country_code.in_(goal.country_codes))
        )
    roles = [role for role in goal.target_roles if role.strip()]
    if roles:
        parts.append(_judge(literal(True), or_(*[_role_matches(role) for role in roles])))
    cities = [city for city in goal.cities if city.strip()]
    if cities:
        parts.append(
            _judge(
                Job.location.is_not(None),
                or_(*[Job.location.ilike(_like(city.strip()), escape="\\") for city in cities]),
            )
        )
    if goal.workplace_types:
        parts.append(
            _judge(Job.workplace_type != "UNKNOWN", Job.workplace_type.in_(goal.workplace_types))
        )
    if goal.employment_types:
        parts.append(
            _judge(Job.employment_type != "UNKNOWN", Job.employment_type.in_(goal.employment_types))
        )
    blocked_keys = [name.strip().lower() for name in goal.company_blocklist if name.strip()]
    blocked = func.lower(func.trim(Job.company)).in_(blocked_keys) if blocked_keys else false()
    total: ColumnElement[int] = literal(0, type_=Integer)
    for part in parts:
        total = total + part
    return case((blocked, BLOCKED_SCORE), else_=total)
