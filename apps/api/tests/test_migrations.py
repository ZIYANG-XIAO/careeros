"""Integration tests for the Alembic migration chain.

Verifies that applying base → 0001_m0_foundation → 0002_m1a_users_and_career_brains
on a clean database produces the expected schema.
"""

import os
import subprocess
import sys

import pytest
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine

from careeros_api.config import get_settings

ALEMBIC_INI = "apps/api/alembic.ini"


def _alembic(cmd: str, target: str) -> None:
    """Run an alembic command."""
    env = {**os.environ, "DATABASE_URL": get_settings().database_url}
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", ALEMBIC_INI, cmd, target],
        check=True,
        capture_output=True,
        env=env,
    )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clean_migration_creates_expected_schema() -> None:
    """Downgrade to base, upgrade to head, then verify tables, columns,
    unique constraints, and foreign keys."""
    db_url = get_settings().database_url

    # Downgrade to a clean state.
    _alembic("downgrade", "base")

    try:
        # Apply all migrations.
        _alembic("upgrade", "head")

        engine = create_async_engine(db_url, pool_pre_ping=True)
        try:
            async with engine.connect() as conn:
                # --- tables exist ---
                table_names = await conn.run_sync(
                    lambda sync_conn: inspect(sync_conn).get_table_names()
                )
                assert "users" in table_names
                assert "career_brains" in table_names

                # --- users columns ---
                user_cols = await conn.run_sync(
                    lambda sync_conn: {
                        c["name"]: c for c in inspect(sync_conn).get_columns("users")
                    }
                )
                expected_user_cols = (
                    "id",
                    "auth_provider",
                    "auth_subject",
                    "email",
                    "created_at",
                    "updated_at",
                )
                for col in expected_user_cols:
                    assert col in user_cols, f"Missing users column: {col}"

                # --- career_brains columns ---
                brain_cols = await conn.run_sync(
                    lambda sync_conn: {
                        c["name"]: c for c in inspect(sync_conn).get_columns("career_brains")
                    }
                )
                for col in ("id", "user_id", "created_at", "updated_at"):
                    assert col in brain_cols, f"Missing career_brains column: {col}"

                # --- unique constraint on (auth_provider, auth_subject) ---
                user_uniques = await conn.run_sync(
                    lambda sync_conn: inspect(sync_conn).get_unique_constraints("users")
                )
                has_composite = any(
                    set(uc["column_names"]) == {"auth_provider", "auth_subject"}
                    for uc in user_uniques
                )
                assert has_composite, "Missing unique constraint on (auth_provider, auth_subject)"

                # --- FK career_brains.user_id → users.id ---
                brain_fks = await conn.run_sync(
                    lambda sync_conn: inspect(sync_conn).get_foreign_keys("career_brains")
                )
                user_id_fk = next(
                    (fk for fk in brain_fks if fk["constrained_columns"] == ["user_id"]),
                    None,
                )
                assert user_id_fk is not None, "Missing FK on career_brains.user_id"
                assert user_id_fk["referred_table"] == "users"
                assert user_id_fk["referred_columns"] == ["id"]

                # --- unique constraint on career_brains.user_id ---
                brain_uniques = await conn.run_sync(
                    lambda sync_conn: inspect(sync_conn).get_unique_constraints("career_brains")
                )
                has_user_id_unique = any(uc["column_names"] == ["user_id"] for uc in brain_uniques)
                if not has_user_id_unique:
                    # PostgreSQL may express column-level unique=True as index.
                    brain_indexes = await conn.run_sync(
                        lambda sync_conn: inspect(sync_conn).get_indexes("career_brains")
                    )
                    has_user_id_unique = any(
                        idx.get("unique") and idx["column_names"] == ["user_id"]
                        for idx in brain_indexes
                    )
                assert has_user_id_unique, "Missing unique constraint on career_brains.user_id"

        finally:
            await engine.dispose()

    finally:
        # Re-apply migrations so subsequent tests find a usable schema.
        _alembic("upgrade", "head")
