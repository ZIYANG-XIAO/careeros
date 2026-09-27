"""Add job_preferences table.

Revision ID: 0018_job_preferences
Revises: 0017_native_name_parts
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0018_job_preferences"
down_revision: str | None = "0017_native_name_parts"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "job_preferences",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("target_roles", sa.JSON(), nullable=False),
        sa.Column("cities", sa.JSON(), nullable=False),
        sa.Column("company_sizes", sa.JSON(), nullable=False),
        sa.Column("industries_include", sa.JSON(), nullable=False),
        sa.Column("industries_exclude", sa.JSON(), nullable=False),
        sa.Column("company_blocklist", sa.JSON(), nullable=False),
        sa.Column("minimum_salary", sa.Integer(), nullable=True),
        sa.Column(
            "security_clearance_interest",
            sa.Boolean(),
            nullable=False,
            server_default=sa.false(),
        ),
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
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id"),
    )


def downgrade() -> None:
    op.drop_table("job_preferences")
