from collections.abc import AsyncGenerator, Generator
from contextlib import asynccontextmanager
from datetime import UTC, datetime
from uuid import UUID, uuid4

import pytest
from fastapi.testclient import TestClient
from httpx import ASGITransport, AsyncClient
from sqlalchemy import delete
from sqlalchemy.ext.asyncio import async_sessionmaker, create_async_engine

from careeros_api.auth import get_current_user
from careeros_api.config import Settings, get_settings
from careeros_api.db import get_db_session
from careeros_api.main import create_app
from careeros_api.models import CareerBrain, User

TEST_USER_ID = UUID("00000000-0000-4000-8000-000000000001")
TEST_BRAIN_ID = UUID("00000000-0000-4000-8000-000000000002")
TEST_TIMESTAMP = datetime(2026, 1, 1, tzinfo=UTC)


def make_test_settings() -> Settings:
    return Settings.model_validate(
        {
            "database_url": "postgresql+asyncpg://unused:unused@localhost/unused",
            "web_origin": "http://localhost:3000",
            "clerk_issuer_url": "https://test.clerk.accounts.dev",
        }
    )


def make_test_user(
    user_id: UUID = TEST_USER_ID,
    brain_id: UUID = TEST_BRAIN_ID,
    auth_subject: str = "test_subject",
    email: str = "test@example.com",
) -> User:
    user = User(
        id=user_id,
        auth_provider="clerk",
        auth_subject=auth_subject,
        email=email,
        created_at=TEST_TIMESTAMP,
        updated_at=TEST_TIMESTAMP,
    )
    brain = CareerBrain(
        id=brain_id,
        user_id=user_id,
        created_at=TEST_TIMESTAMP,
        updated_at=TEST_TIMESTAMP,
    )
    user.career_brain = brain
    return user


@pytest.fixture
def authenticated_client() -> Generator[TestClient]:
    application = create_app(make_test_settings())
    test_user = make_test_user()

    async def override_get_current_user() -> User:
        return test_user

    application.dependency_overrides[get_current_user] = override_get_current_user

    with TestClient(application) as client:
        yield client  # type: ignore[misc]


@asynccontextmanager
async def make_integration_client(
    user_id: UUID | None = None,
    brain_id: UUID | None = None,
) -> AsyncGenerator[AsyncClient]:
    """Create an authenticated AsyncClient backed by a real DB user+brain.

    Inserts a real User and CareerBrain into the database, overrides
    ``get_current_user`` to return that user, and yields an httpx
    AsyncClient.  Cleans up on exit.
    """
    uid = user_id or uuid4()
    bid = brain_id or uuid4()
    auth_subject = f"test_{uid.hex[:12]}"

    settings = get_settings()
    engine = create_async_engine(settings.database_url, pool_pre_ping=True)
    factory = async_sessionmaker(engine, expire_on_commit=False)

    # Insert real user+brain for FK integrity.
    async with factory() as session:
        user_db = User(
            id=uid,
            auth_provider="clerk",
            auth_subject=auth_subject,
            email=f"{auth_subject}@test.com",
        )
        session.add(user_db)
        await session.flush()
        session.add(CareerBrain(id=bid, user_id=uid))
        await session.commit()

    test_user = make_test_user(user_id=uid, brain_id=bid, auth_subject=auth_subject)

    app = create_app()

    async def override_auth() -> User:
        return test_user

    async def override_db() -> AsyncGenerator[AsyncClient]:
        async with factory() as session:
            try:
                yield session  # type: ignore[misc]
                await session.commit()
            except Exception:
                await session.rollback()
                raise

    app.dependency_overrides[get_current_user] = override_auth
    app.dependency_overrides[get_db_session] = override_db

    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as client:
        try:
            yield client
        finally:
            async with factory() as session:
                await session.execute(delete(CareerBrain).where(CareerBrain.id == bid))
                await session.execute(delete(User).where(User.id == uid))
                await session.commit()
            await engine.dispose()
