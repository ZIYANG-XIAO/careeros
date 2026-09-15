import asyncio
from typing import Any
from unittest.mock import patch
from uuid import uuid4

import pytest
import sqlalchemy as sa
from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from careeros_api.auth import resolve_or_create_user
from careeros_api.config import get_settings
from careeros_api.models import CareerBrain, User

# ---------------------------------------------------------------------------
# Sequential provisioning
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
async def test_first_auth_creates_user_and_career_brain() -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as session:
        token_payload = {"sub": "test_provision_subject", "email": "provision@test.com"}
        user = await resolve_or_create_user(token_payload, session)

        assert user.auth_provider == "clerk"
        assert user.auth_subject == "test_provision_subject"
        assert user.email == "provision@test.com"
        assert user.id is not None

        result = await session.execute(select(CareerBrain).where(CareerBrain.user_id == user.id))
        brain = result.scalar_one()
        assert brain is not None
        assert brain.user_id == user.id

        await session.rollback()

    await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_second_auth_returns_existing_user() -> None:
    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    async with factory() as session:
        token_payload = {"sub": "test_idempotent_subject", "email": "idempotent@test.com"}

        user_first = await resolve_or_create_user(token_payload, session)
        await session.flush()

        user_second = await resolve_or_create_user(token_payload, session)

        assert user_first.id == user_second.id

        await session.rollback()

    await engine.dispose()


# ---------------------------------------------------------------------------
# Concurrent provisioning — the core race-condition test
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
async def test_concurrent_first_provisioning_both_succeed() -> None:
    """Two concurrent first-time requests for the same identity must both
    succeed and resolve to exactly one User / CareerBrain pair.

    Determinism: a barrier is injected at ``session.begin_nested()`` so that
    both coroutines must complete their initial SELECT (and observe no
    existing user) before either proceeds to INSERT.  This guarantees the
    exact interleaving that triggers the SAVEPOINT + IntegrityError path
    and would fail against a naive implementation without that protection.
    """
    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    unique_subject = f"concurrent_{uuid4().hex[:12]}"
    token_payload = {"sub": unique_subject, "email": "concurrent@test.com"}

    # Barrier fires when both coroutines have passed the SELECT (which
    # returned no user) and are about to enter the SAVEPOINT for INSERT.
    insert_barrier = asyncio.Barrier(2)
    barrier_hit_count = 0

    original_begin_nested = AsyncSession.begin_nested

    class _BarrierNestedCtx:
        """Wraps the real begin_nested async context manager to inject a
        barrier wait in ``__aenter__``, proving both SELECTs completed
        before either INSERT begins."""

        def __init__(self, real_ctx: Any) -> None:
            self._real = real_ctx

        async def __aenter__(self) -> Any:
            nonlocal barrier_hit_count
            barrier_hit_count += 1
            await insert_barrier.wait()
            return await self._real.__aenter__()

        async def __aexit__(self, *args: object) -> Any:
            return await self._real.__aexit__(*args)

    def patched_begin_nested(self: AsyncSession) -> _BarrierNestedCtx:  # type: ignore[override]
        return _BarrierNestedCtx(original_begin_nested(self))

    async def provision() -> str:
        async with factory() as session:
            user = await resolve_or_create_user(token_payload, session)
            await session.commit()
            return str(user.id)

    try:
        with patch.object(AsyncSession, "begin_nested", patched_begin_nested):
            id_a, id_b = await asyncio.gather(provision(), provision())

        # Both coroutines must have hit the barrier (proves both observed
        # no existing user before either attempted INSERT).
        assert barrier_hit_count == 2

        # Both requests must succeed and resolve to the same user.
        assert id_a == id_b

        # Database must contain exactly one User and one CareerBrain.
        async with factory() as session:
            user_count = (
                await session.execute(
                    select(sa.func.count())
                    .select_from(User)
                    .where(User.auth_subject == unique_subject)
                )
            ).scalar_one()
            assert user_count == 1

            user = (
                await session.execute(select(User).where(User.auth_subject == unique_subject))
            ).scalar_one()

            brain_count = (
                await session.execute(
                    select(sa.func.count())
                    .select_from(CareerBrain)
                    .where(CareerBrain.user_id == user.id)
                )
            ).scalar_one()
            assert brain_count == 1

    finally:
        # Cleanup test data regardless of outcome.
        async with factory() as session:
            user_result = await session.execute(
                select(User).where(User.auth_subject == unique_subject)
            )
            user = user_result.scalar_one_or_none()
            if user:
                await session.execute(delete(CareerBrain).where(CareerBrain.user_id == user.id))
                await session.execute(delete(User).where(User.id == user.id))
                await session.commit()

        await engine.dispose()


# ---------------------------------------------------------------------------
# Ownership isolation
# ---------------------------------------------------------------------------


@pytest.mark.integration
@pytest.mark.asyncio
async def test_different_identities_get_different_users_and_brains() -> None:
    """Two distinct external identities must produce distinct internal Users
    and distinct CareerBrains."""
    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    subject_a = f"owner_a_{uuid4().hex[:8]}"
    subject_b = f"owner_b_{uuid4().hex[:8]}"

    try:
        async with factory() as session:
            payload_a = {"sub": subject_a, "email": "a@test.com"}
            user_a = await resolve_or_create_user(payload_a, session)
            payload_b = {"sub": subject_b, "email": "b@test.com"}
            user_b = await resolve_or_create_user(payload_b, session)
            await session.commit()

        assert user_a.id != user_b.id
        assert user_a.career_brain.id != user_b.career_brain.id

    finally:
        async with factory() as session:
            for subject in (subject_a, subject_b):
                user_result = await session.execute(
                    select(User).where(User.auth_subject == subject)
                )
                user = user_result.scalar_one_or_none()
                if user:
                    await session.execute(delete(CareerBrain).where(CareerBrain.user_id == user.id))
                    await session.execute(delete(User).where(User.id == user.id))
            await session.commit()

        await engine.dispose()
