"""Add the canonical job-source boundary.

Revision ID: 0008_m9_job_source_boundary
Revises: 0007_m8_saved_jobs
Create Date: 2026-09-23
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0008_m9_job_source_boundary"
down_revision: str | None = "0007_m8_saved_jobs"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("source_key", sa.String(length=100), nullable=False, server_default="manual"),
    )
    op.add_column("jobs", sa.Column("external_job_id", sa.String(length=500), nullable=True))
    op.add_column("jobs", sa.Column("canonical_url", sa.String(length=2000), nullable=True))
    op.add_column("jobs", sa.Column("first_observed_at", sa.DateTime(timezone=True)))
    op.add_column("jobs", sa.Column("last_observed_at", sa.DateTime(timezone=True)))
    op.add_column(
        "jobs",
        sa.Column(
            "availability_status",
            sa.String(length=50),
            nullable=False,
            server_default="UNKNOWN",
        ),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "freshness_status",
            sa.String(length=50),
            nullable=False,
            server_default="UNKNOWN",
        ),
    )
    op.execute(
        """
        UPDATE jobs
        SET first_observed_at = captured_at,
            last_observed_at = captured_at
        WHERE first_observed_at IS NULL OR last_observed_at IS NULL
        """
    )
    op.alter_column("jobs", "source_key", server_default=None)
    op.create_index(
        "uq_jobs_user_source_external_id",
        "jobs",
        ["user_id", "source_key", "external_job_id"],
        unique=True,
        postgresql_where=sa.text("external_job_id IS NOT NULL"),
    )
    op.create_index(
        "uq_jobs_user_canonical_url",
        "jobs",
        ["user_id", "canonical_url"],
        unique=True,
        postgresql_where=sa.text("canonical_url IS NOT NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_jobs_user_canonical_url", table_name="jobs")
    op.drop_index("uq_jobs_user_source_external_id", table_name="jobs")
    op.drop_column("jobs", "freshness_status")
    op.drop_column("jobs", "availability_status")
    op.drop_column("jobs", "last_observed_at")
    op.drop_column("jobs", "first_observed_at")
    op.drop_column("jobs", "canonical_url")
    op.drop_column("jobs", "external_job_id")
    op.drop_column("jobs", "source_key")
