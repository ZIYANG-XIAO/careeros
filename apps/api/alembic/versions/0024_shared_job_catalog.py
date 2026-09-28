"""Shared job catalog: jobs without an owner are visible to every user.

Also versions analyses per user, and lets catalog snapshots defer requirement
extraction until first use.

Revision ID: 0024_shared_job_catalog
Revises: 0023_application_contacts
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0024_shared_job_catalog"
down_revision: str | None = "0023_application_contacts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.alter_column("jobs", "user_id", existing_type=sa.Uuid(), nullable=True)

    op.drop_index("uq_jobs_user_source_external_id", table_name="jobs")
    op.drop_index("uq_jobs_user_canonical_url", table_name="jobs")
    op.create_index(
        "uq_jobs_user_source_external_id",
        "jobs",
        ["user_id", "source_key", "external_job_id"],
        unique=True,
        postgresql_where=sa.text("external_job_id IS NOT NULL AND user_id IS NOT NULL"),
    )
    op.create_index(
        "uq_jobs_user_canonical_url",
        "jobs",
        ["user_id", "canonical_url"],
        unique=True,
        postgresql_where=sa.text("canonical_url IS NOT NULL AND user_id IS NOT NULL"),
    )
    op.create_index(
        "uq_jobs_catalog_source_external_id",
        "jobs",
        ["source_key", "external_job_id"],
        unique=True,
        postgresql_where=sa.text("external_job_id IS NOT NULL AND user_id IS NULL"),
    )
    op.create_index(
        "uq_jobs_catalog_canonical_url",
        "jobs",
        ["canonical_url"],
        unique=True,
        postgresql_where=sa.text("canonical_url IS NOT NULL AND user_id IS NULL"),
    )

    op.drop_constraint("job_analyses_job_id_analysis_version_key", "job_analyses", type_="unique")
    op.create_unique_constraint(
        "job_analyses_job_id_user_id_analysis_version_key",
        "job_analyses",
        ["job_id", "user_id", "analysis_version"],
    )

    op.add_column(
        "job_snapshots",
        sa.Column(
            "requirements_status",
            sa.String(length=20),
            nullable=False,
            server_default="PARSED",
        ),
    )
    op.create_check_constraint(
        "ck_job_snapshots_requirements_status",
        "job_snapshots",
        "requirements_status IN ('PENDING', 'PARSED')",
    )
    op.create_index("ix_job_snapshots_content_sha256", "job_snapshots", ["content_sha256"])


def downgrade() -> None:
    # Catalog jobs have no owner to fall back to; they are removed on downgrade.
    op.execute(sa.text("DELETE FROM jobs WHERE user_id IS NULL"))
    op.drop_index("ix_job_snapshots_content_sha256", table_name="job_snapshots")
    op.drop_constraint("ck_job_snapshots_requirements_status", "job_snapshots", type_="check")
    op.drop_column("job_snapshots", "requirements_status")

    op.drop_constraint(
        "job_analyses_job_id_user_id_analysis_version_key", "job_analyses", type_="unique"
    )
    op.create_unique_constraint(
        "job_analyses_job_id_analysis_version_key",
        "job_analyses",
        ["job_id", "analysis_version"],
    )

    op.drop_index("uq_jobs_catalog_canonical_url", table_name="jobs")
    op.drop_index("uq_jobs_catalog_source_external_id", table_name="jobs")
    op.drop_index("uq_jobs_user_canonical_url", table_name="jobs")
    op.drop_index("uq_jobs_user_source_external_id", table_name="jobs")
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
    op.alter_column("jobs", "user_id", existing_type=sa.Uuid(), nullable=False)
