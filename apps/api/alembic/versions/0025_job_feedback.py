"""Add per-user job dismissals and hidden companies.

Revision ID: 0025_job_feedback
Revises: 0024_shared_job_catalog
Create Date: 2026-10-01
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0025_job_feedback"
down_revision: str | None = "0024_shared_job_catalog"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "job_dismissals",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "job_id"),
    )
    op.create_index("ix_job_dismissals_user_id", "job_dismissals", ["user_id"])
    op.create_table(
        "hidden_companies",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("company_key", sa.String(length=500), nullable=False),
        sa.Column("company_name", sa.String(length=500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "company_key"),
    )
    op.create_index("ix_hidden_companies_user_id", "hidden_companies", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_hidden_companies_user_id", table_name="hidden_companies")
    op.drop_table("hidden_companies")
    op.drop_index("ix_job_dismissals_user_id", table_name="job_dismissals")
    op.drop_table("job_dismissals")
