"""Add multi-market job search goals.

Revision ID: 0021_job_search_goals
Revises: 0020_application_activities
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0021_job_search_goals"
down_revision: str | None = "0020_application_activities"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "job_search_goals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=100), nullable=False),
        sa.Column("market", sa.String(length=50), nullable=False),
        sa.Column("country_codes", sa.JSON(), nullable=False),
        sa.Column("target_roles", sa.JSON(), nullable=False),
        sa.Column("cities", sa.JSON(), nullable=False),
        sa.Column("workplace_types", sa.JSON(), nullable=False),
        sa.Column("employment_types", sa.JSON(), nullable=False),
        sa.Column("company_sizes", sa.JSON(), nullable=False),
        sa.Column("industries_include", sa.JSON(), nullable=False),
        sa.Column("industries_exclude", sa.JSON(), nullable=False),
        sa.Column("company_blocklist", sa.JSON(), nullable=False),
        sa.Column("minimum_salary", sa.Integer(), nullable=True),
        sa.Column("salary_currency", sa.String(length=3), nullable=True),
        sa.Column("default_resume_id", sa.Uuid(), nullable=True),
        sa.Column("security_clearance_interest", sa.Boolean(), nullable=False),
        sa.Column("is_active", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.CheckConstraint(
            "market IN ('UNKNOWN', 'NORTH_AMERICA', 'CHINA')",
            name="ck_job_search_goals_market",
        ),
        sa.CheckConstraint(
            "minimum_salary IS NULL OR minimum_salary >= 0",
            name="ck_job_search_goals_minimum_salary",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["default_resume_id"], ["resumes.id"], ondelete="SET NULL"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_job_search_goals_user_id", "job_search_goals", ["user_id"])
    op.create_index(
        "uq_job_search_goals_one_active_per_user",
        "job_search_goals",
        ["user_id"],
        unique=True,
        postgresql_where=sa.text("is_active"),
    )
    op.execute(
        sa.text(
            """
            INSERT INTO job_search_goals (
                id, user_id, name, market, country_codes, target_roles, cities,
                workplace_types, employment_types, company_sizes,
                industries_include, industries_exclude, company_blocklist,
                minimum_salary, salary_currency, default_resume_id,
                security_clearance_interest, is_active, created_at, updated_at
            )
            SELECT
                id, user_id, 'Primary search', 'UNKNOWN', CAST('[]' AS JSON),
                target_roles, cities, CAST('[]' AS JSON), CAST('[]' AS JSON),
                company_sizes, industries_include, industries_exclude,
                company_blocklist, minimum_salary, NULL, NULL,
                security_clearance_interest, true, created_at, updated_at
            FROM job_preferences
            """
        )
    )


def downgrade() -> None:
    op.drop_index("uq_job_search_goals_one_active_per_user", table_name="job_search_goals")
    op.drop_index("ix_job_search_goals_user_id", table_name="job_search_goals")
    op.drop_table("job_search_goals")
