"""Add application_status_history table.

Revision ID: 0019_application_status_history
Revises: 0018_job_preferences
Create Date: 2026-09-27
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0019_application_status_history"
down_revision: str | None = "0018_job_preferences"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "application_status_history",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("from_status", sa.String(length=50), nullable=True),
        sa.Column("to_status", sa.String(length=50), nullable=False),
        sa.Column(
            "changed_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_application_status_history_application_id",
        "application_status_history",
        ["application_id"],
    )

    # Backfill one row per existing application, so the timeline is never
    # empty for applications created before this migration.
    op.execute(
        """
        INSERT INTO application_status_history
            (id, application_id, from_status, to_status, changed_at)
        SELECT gen_random_uuid(), id, NULL, status, status_updated_at
        FROM applications
        """
    )


def downgrade() -> None:
    op.drop_index(
        "ix_application_status_history_application_id",
        table_name="application_status_history",
    )
    op.drop_table("application_status_history")
