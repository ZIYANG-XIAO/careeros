"""Add market-aware canonical job metadata.

Revision ID: 0011_m17_job_market_filters
Revises: 0010_m15_application_submission
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0011_m17_job_market_filters"
down_revision: str | None = "0010_m15_application_submission"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "jobs",
        sa.Column("market", sa.String(length=50), nullable=False, server_default="UNKNOWN"),
    )
    op.add_column(
        "jobs",
        sa.Column("country_code", sa.String(length=20), nullable=False, server_default="UNKNOWN"),
    )
    op.add_column(
        "jobs",
        sa.Column("workplace_type", sa.String(length=50), nullable=False, server_default="UNKNOWN"),
    )
    op.add_column(
        "jobs",
        sa.Column(
            "employment_type", sa.String(length=50), nullable=False, server_default="UNKNOWN"
        ),
    )
    op.create_check_constraint(
        "ck_jobs_market",
        "jobs",
        "market IN ('UNKNOWN', 'NORTH_AMERICA', 'CHINA')",
    )
    op.create_check_constraint(
        "ck_jobs_country_code",
        "jobs",
        "country_code IN ('UNKNOWN', 'US', 'CA', 'CN')",
    )
    op.create_check_constraint(
        "ck_jobs_market_country",
        "jobs",
        "(market = 'UNKNOWN' AND country_code = 'UNKNOWN') OR "
        "(market = 'NORTH_AMERICA' AND country_code IN ('UNKNOWN', 'US', 'CA')) OR "
        "(market = 'CHINA' AND country_code IN ('UNKNOWN', 'CN'))",
    )
    op.create_check_constraint(
        "ck_jobs_workplace_type",
        "jobs",
        "workplace_type IN ('UNKNOWN', 'REMOTE', 'HYBRID', 'ONSITE')",
    )
    op.create_check_constraint(
        "ck_jobs_employment_type",
        "jobs",
        "employment_type IN ('UNKNOWN', 'FULL_TIME', 'PART_TIME', 'CONTRACT', 'INTERNSHIP')",
    )
    op.create_index("ix_jobs_user_market", "jobs", ["user_id", "market"])


def downgrade() -> None:
    op.drop_index("ix_jobs_user_market", table_name="jobs")
    op.drop_constraint("ck_jobs_employment_type", "jobs", type_="check")
    op.drop_constraint("ck_jobs_workplace_type", "jobs", type_="check")
    op.drop_constraint("ck_jobs_market_country", "jobs", type_="check")
    op.drop_constraint("ck_jobs_country_code", "jobs", type_="check")
    op.drop_constraint("ck_jobs_market", "jobs", type_="check")
    op.drop_column("jobs", "employment_type")
    op.drop_column("jobs", "workplace_type")
    op.drop_column("jobs", "country_code")
    op.drop_column("jobs", "market")
