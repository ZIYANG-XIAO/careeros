"""Integration tests for UserContactInfo endpoints."""

import asyncio
import os
import subprocess
import sys
from typing import Any
from uuid import uuid4

import pytest
from conftest import make_integration_client
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine

from careeros_api.config import get_settings
from careeros_api.models import UserContactInfo

ALEMBIC_INI = "apps/api/alembic.ini"


def _get_test_db_url() -> str | None:
    return os.environ.get("TEST_DATABASE_URL")


def _alembic(cmd: str, target: str, database_url: str) -> None:
    env = {**os.environ, "DATABASE_URL": database_url}
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", ALEMBIC_INI, cmd, target],
        check=True,
        capture_output=True,
        env=env,
    )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_get_contact_info_empty_when_none_exists() -> None:
    async with make_integration_client() as client:
        resp = await client.get("/contact-info")
        assert resp.status_code == 200
        data = resp.json()
        assert data["id"] is None
        assert data["first_name"] is None
        assert data["last_name"] is None
        assert data["confirmed_at"] is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_create_contact_info() -> None:
    async with make_integration_client() as client:
        resp = await client.put(
            "/contact-info",
            json={
                "first_name": "Jane",
                "last_name": "Doe",
                "full_name_native": "王小明",
                "contact_email": "jobs@example.com",
                "phone": "+1 (555) 123-4567",
                "wechat_id": "wx-career",
                "linkedin_url": "https://linkedin.com/in/janedoe",
                "github_url": "https://github.com/janedoe",
            },
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["first_name"] == "Jane"
        assert data["last_name"] == "Doe"
        assert data["full_name_native"] == "王小明"
        assert data["contact_email"] == "jobs@example.com"
        assert data["phone"] == "+1 (555) 123-4567"
        assert data["wechat_id"] == "wx-career"
        assert data["linkedin_url"] == "https://linkedin.com/in/janedoe"
        assert data["github_url"] == "https://github.com/janedoe"
        assert data["id"] is not None
        assert data["confirmed_at"] is not None
        assert data["created_at"] is not None

        get_resp = await client.get("/contact-info")
        assert get_resp.status_code == 200
        assert get_resp.json()["first_name"] == "Jane"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_update_existing_contact_info() -> None:
    async with make_integration_client() as client:
        await client.put(
            "/contact-info",
            json={"first_name": "Jane", "last_name": "Doe"},
        )

        resp = await client.put(
            "/contact-info",
            json={"first_name": "Janet", "city": "Boston"},
        )
        assert resp.status_code == 200
        data = resp.json()
        assert data["first_name"] == "Janet"
        assert data["last_name"] == "Doe"
        assert data["city"] == "Boston"
        assert data["confirmed_at"] is not None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_contact_info_ownership_isolation() -> None:
    async with make_integration_client() as client_a:
        await client_a.put(
            "/contact-info",
            json={"first_name": "Alice", "last_name": "Smith"},
        )

        async with make_integration_client() as client_b:
            resp = await client_b.get("/contact-info")
            assert resp.status_code == 200
            assert resp.json()["id"] is None
            assert resp.json()["first_name"] is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_invalid_phone_rejected() -> None:
    async with make_integration_client() as client:
        resp = await client.put("/contact-info", json={"phone": "abc"})
        assert resp.status_code == 422
        assert "invalid phone format" in resp.text


@pytest.mark.integration
@pytest.mark.asyncio
async def test_invalid_linkedin_url_rejected() -> None:
    async with make_integration_client() as client:
        resp = await client.put("/contact-info", json={"linkedin_url": "not-a-url"})
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_invalid_contact_email_rejected() -> None:
    async with make_integration_client() as client:
        invalid_email = await client.put("/contact-info", json={"contact_email": "not-an-email"})
        assert invalid_email.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_invalid_portfolio_url_rejected() -> None:
    async with make_integration_client() as client:
        resp = await client.put("/contact-info", json={"portfolio_url": "ftp://bad"})
        assert resp.status_code == 422


@pytest.mark.integration
@pytest.mark.asyncio
async def test_country_code_too_long_rejected() -> None:
    async with make_integration_client() as client:
        resp = await client.put("/contact-info", json={"country_code": "USA"})
        assert resp.status_code == 422
        assert "country_code must be exactly 2 characters" in resp.text


@pytest.mark.integration
@pytest.mark.asyncio
async def test_missing_optional_fields_accepted() -> None:
    async with make_integration_client() as client:
        resp = await client.put("/contact-info", json={"first_name": "OnlyFirst"})
        assert resp.status_code == 200
        data = resp.json()
        assert data["first_name"] == "OnlyFirst"
        assert data["last_name"] is None
        assert data["phone"] is None
        assert data["country_code"] is None


@pytest.mark.integration
@pytest.mark.asyncio
async def test_country_code_normalized_to_uppercase() -> None:
    async with make_integration_client() as client:
        resp = await client.put("/contact-info", json={"country_code": "us"})
        assert resp.status_code == 200
        assert resp.json()["country_code"] == "US"


@pytest.mark.integration
@pytest.mark.asyncio
async def test_concurrent_initialization_creates_single_record() -> None:
    """Two concurrent first-time upserts for the same user must produce one row."""
    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    uid = uuid4()
    bid = uuid4()
    auth_subject = f"contact_concurrent_{uid.hex[:12]}"

    from careeros_api.models import CareerBrain, User

    async with factory() as session:
        session.add(
            User(
                id=uid,
                auth_provider="clerk",
                auth_subject=auth_subject,
                email=f"{auth_subject}@test.com",
            )
        )
        await session.flush()
        session.add(CareerBrain(id=bid, user_id=uid))
        await session.commit()

    insert_barrier = asyncio.Barrier(2)
    barrier_hit_count = 0
    original_begin_nested = AsyncSession.begin_nested

    class _BarrierNestedCtx:
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

    from unittest.mock import patch

    from conftest import make_test_settings, make_test_user
    from httpx import ASGITransport, AsyncClient

    from careeros_api.auth import get_current_user
    from careeros_api.db import get_db_session
    from careeros_api.main import create_app

    test_user = make_test_user(user_id=uid, brain_id=bid, auth_subject=auth_subject)
    app_settings = make_test_settings()
    app = create_app(app_settings)

    async def override_auth() -> User:
        return test_user

    async def override_db() -> Any:
        async with factory() as session:
            try:
                yield session
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_current_user] = override_auth
    app.dependency_overrides[get_db_session] = override_db

    transport = ASGITransport(app=app)

    async def upsert_first_name(name: str) -> dict[str, Any]:
        async with AsyncClient(transport=transport, base_url="http://test") as client:
            resp = await client.put("/contact-info", json={"first_name": name})
            assert resp.status_code == 200
            return resp.json()

    try:
        with patch.object(AsyncSession, "begin_nested", patched_begin_nested):
            results = await asyncio.gather(
                upsert_first_name("RaceA"),
                upsert_first_name("RaceB"),
            )
        assert barrier_hit_count == 2

        async with factory() as session:
            count = await session.scalar(
                select(func.count())
                .select_from(UserContactInfo)
                .where(UserContactInfo.user_id == uid)
            )
            assert count == 1

            row = (
                await session.execute(select(UserContactInfo).where(UserContactInfo.user_id == uid))
            ).scalar_one()
            saved_names = {row.first_name}
            assert saved_names.intersection({"RaceA", "RaceB"})
            assert all(r["id"] == str(row.id) for r in results)
    finally:
        async with factory() as session:
            await session.execute(delete(UserContactInfo).where(UserContactInfo.user_id == uid))
            await session.execute(delete(CareerBrain).where(CareerBrain.id == bid))
            await session.execute(delete(User).where(User.id == uid))
            await session.commit()
        await engine.dispose()


@pytest.mark.integration
@pytest.mark.asyncio
async def test_user_contact_info_migration_upgrade_and_downgrade() -> None:
    """Verify migration 0012 can upgrade and downgrade cleanly."""
    test_db_url = _get_test_db_url()
    if test_db_url is None:
        pytest.skip("TEST_DATABASE_URL not set; skipping migration test")

    app_db_url = os.environ.get("DATABASE_URL")
    if app_db_url and test_db_url == app_db_url:
        pytest.fail(
            "TEST_DATABASE_URL must not equal DATABASE_URL — "
            "refusing to run destructive migration test"
        )

    _alembic("upgrade", "0012_user_contact_info", test_db_url)

    engine = create_async_engine(test_db_url, pool_pre_ping=True)
    try:
        async with engine.connect() as conn:
            table_names = await conn.run_sync(
                lambda sync_conn: __import__("sqlalchemy").inspect(sync_conn).get_table_names()
            )
            assert "user_contact_info" in table_names

            uniques = await conn.run_sync(
                lambda sync_conn: (
                    __import__("sqlalchemy")
                    .inspect(sync_conn)
                    .get_unique_constraints("user_contact_info")
                )
            )
            assert any(set(c["column_names"]) == {"user_id"} for c in uniques), (
                "Missing unique constraint on user_contact_info.user_id"
            )
    finally:
        await engine.dispose()

    _alembic("downgrade", "0011_m17_job_market_filters", test_db_url)

    engine = create_async_engine(test_db_url, pool_pre_ping=True)
    try:
        async with engine.connect() as conn:
            table_names = await conn.run_sync(
                lambda sync_conn: __import__("sqlalchemy").inspect(sync_conn).get_table_names()
            )
            assert "user_contact_info" not in table_names
    finally:
        await engine.dispose()

    _alembic("upgrade", "head", test_db_url)
