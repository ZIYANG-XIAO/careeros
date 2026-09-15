"""Integration tests for the Alembic migration chain.

Verifies that applying base → 0001_m0_foundation → 0002_m1a_users_and_career_brains
→ 0003_m1b_entities_evidence on a clean database produces the expected schema.

SAFETY: These tests perform destructive operations (downgrade base) and require
``TEST_DATABASE_URL`` to be set to an explicitly disposable database.  They will
never run against the application database.
"""

import os
import subprocess
import sys

import pytest
from sqlalchemy import inspect
from sqlalchemy.ext.asyncio import create_async_engine

ALEMBIC_INI = "apps/api/alembic.ini"


def _get_test_db_url() -> str | None:
    """Return TEST_DATABASE_URL or None if not configured."""
    return os.environ.get("TEST_DATABASE_URL")


def _alembic(cmd: str, target: str, database_url: str) -> None:
    """Run an alembic command against the given database URL."""
    env = {**os.environ, "DATABASE_URL": database_url}
    subprocess.run(
        [sys.executable, "-m", "alembic", "-c", ALEMBIC_INI, cmd, target],
        check=True,
        capture_output=True,
        env=env,
    )


def test_migration_tests_never_use_application_db() -> None:
    """Guard: TEST_DATABASE_URL must differ from DATABASE_URL when both are set."""
    app_url = os.environ.get("DATABASE_URL")
    test_url = os.environ.get("TEST_DATABASE_URL")
    if app_url and test_url:
        assert app_url != test_url, (
            "TEST_DATABASE_URL must not equal DATABASE_URL — "
            "migration tests must target a disposable database"
        )


@pytest.mark.integration
@pytest.mark.asyncio
async def test_clean_migration_creates_expected_schema() -> None:
    """Downgrade to base, upgrade to head, then verify tables, columns,
    unique constraints, and foreign keys."""
    test_db_url = _get_test_db_url()
    if test_db_url is None:
        pytest.skip("TEST_DATABASE_URL not set; skipping destructive migration test")

    # Safety guard: refuse if pointing at the application database.
    app_db_url = os.environ.get("DATABASE_URL")
    if app_db_url and test_db_url == app_db_url:
        pytest.fail(
            "TEST_DATABASE_URL must not equal DATABASE_URL — "
            "refusing to downgrade application database"
        )

    # Downgrade to a clean state.
    _alembic("downgrade", "base", test_db_url)

    try:
        # Apply all migrations.
        _alembic("upgrade", "head", test_db_url)

        engine = create_async_engine(test_db_url, pool_pre_ping=True)
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

                # -----------------------------------------------------------
                # M1B tables
                # -----------------------------------------------------------

                m1b_tables = [
                    "educations",
                    "experiences",
                    "experience_details",
                    "projects",
                    "project_details",
                    "skills",
                    "career_evidence",
                    "career_evidence_revisions",
                ]
                for tbl in m1b_tables:
                    assert tbl in table_names, f"Missing M1B table: {tbl}"

                # --- educations columns ---
                edu_cols = await conn.run_sync(
                    lambda sync_conn: {
                        c["name"]: c for c in inspect(sync_conn).get_columns("educations")
                    }
                )
                for col in (
                    "id",
                    "career_brain_id",
                    "institution",
                    "degree",
                    "field_of_study",
                    "location",
                    "start_date",
                    "end_date",
                ):
                    assert col in edu_cols, f"Missing educations column: {col}"

                # --- experiences columns ---
                exp_cols = await conn.run_sync(
                    lambda sync_conn: {
                        c["name"]: c for c in inspect(sync_conn).get_columns("experiences")
                    }
                )
                for col in (
                    "id",
                    "career_brain_id",
                    "company",
                    "title",
                    "is_current",
                ):
                    assert col in exp_cols, f"Missing experiences column: {col}"

                # --- career_evidence unique (source_type, source_id) ---
                ev_uniques = await conn.run_sync(
                    lambda sync_conn: inspect(sync_conn).get_unique_constraints("career_evidence")
                )
                has_source_unique = any(
                    set(uc["column_names"]) == {"source_type", "source_id"} for uc in ev_uniques
                )
                assert has_source_unique, "Missing unique constraint on (source_type, source_id)"

                # --- career_evidence_revisions unique (evidence_id, revision_number)
                rev_uniques = await conn.run_sync(
                    lambda sync_conn: inspect(sync_conn).get_unique_constraints(
                        "career_evidence_revisions"
                    )
                )
                has_rev_unique = any(
                    set(uc["column_names"]) == {"evidence_id", "revision_number"}
                    for uc in rev_uniques
                )
                assert has_rev_unique, "Missing unique constraint on (evidence_id, revision_number)"

                # --- FK educations.career_brain_id → career_brains.id ---
                edu_fks = await conn.run_sync(
                    lambda sync_conn: inspect(sync_conn).get_foreign_keys("educations")
                )
                edu_fk = next(
                    (fk for fk in edu_fks if fk["constrained_columns"] == ["career_brain_id"]),
                    None,
                )
                assert edu_fk is not None, "Missing FK on educations.career_brain_id"
                assert edu_fk["referred_table"] == "career_brains"

                # --- FK revisions.evidence_id → career_evidence.id ---
                rev_fks = await conn.run_sync(
                    lambda sync_conn: inspect(sync_conn).get_foreign_keys(
                        "career_evidence_revisions"
                    )
                )
                rev_fk = next(
                    (fk for fk in rev_fks if fk["constrained_columns"] == ["evidence_id"]),
                    None,
                )
                assert rev_fk is not None, "Missing FK on revisions.evidence_id"
                assert rev_fk["referred_table"] == "career_evidence"

        finally:
            await engine.dispose()

    finally:
        # Re-apply migrations so subsequent tests find a usable schema.
        _alembic("upgrade", "head", test_db_url)
