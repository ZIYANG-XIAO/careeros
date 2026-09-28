"""Per-user limits on endpoints that call paid AI providers.

In-memory sliding window: it protects cost and abuse on a single API process.
Several processes each keep their own window, so the effective limit scales
with the process count until a shared store is introduced.
"""

import math
import time
from collections import defaultdict, deque
from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status

from careeros_api.auth import get_current_user
from careeros_api.config import Settings, get_settings
from careeros_api.models import User

WINDOW_SECONDS = 60.0


class SlidingWindowLimiter:
    def __init__(self) -> None:
        self._hits: defaultdict[UUID, deque[float]] = defaultdict(deque)

    def check(self, key: UUID, limit: int, now: float | None = None) -> float | None:
        """Record a hit; return seconds to wait when over the limit, else None."""
        moment = time.monotonic() if now is None else now
        hits = self._hits[key]
        while hits and moment - hits[0] >= WINDOW_SECONDS:
            hits.popleft()
        if len(hits) >= limit:
            return WINDOW_SECONDS - (moment - hits[0])
        hits.append(moment)
        return None

    def reset(self) -> None:
        self._hits.clear()


ai_limiter = SlidingWindowLimiter()


async def ai_rate_limit(
    user: Annotated[User, Depends(get_current_user)],
    settings: Annotated[Settings, Depends(get_settings)],
) -> None:
    if settings.ai_requests_per_minute <= 0:
        return
    wait = ai_limiter.check(user.id, settings.ai_requests_per_minute)
    if wait is not None:
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail={
                "code": "RATE_LIMITED",
                "message": "Too many AI-assisted requests; try again shortly",
            },
            headers={"Retry-After": str(max(1, math.ceil(wait)))},
        )
