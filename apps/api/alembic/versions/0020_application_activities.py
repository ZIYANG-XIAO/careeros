"""Add user-planned application activities.

Revision ID: 0020_application_activities
Revises: 0019_application_status_history
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0020_application_activities"
down_revision: str | None = "0019_application_status_history"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "application_activities",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("activity_type", sa.String(length=50), nullable=False),
        sa.Column("title", sa.String(length=200), nullable=False),
        sa.Column("body", sa.Text(), nullable=True),
        sa.Column("scheduled_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("completed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("idempotency_key", sa.Uuid(), nullable=False),
        sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
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
            "activity_type IN ('NOTE', 'FOLLOW_UP', 'INTERVIEW')",
            name="ck_application_activities_type",
        ),
        sa.CheckConstraint(
            "(activity_type = 'NOTE' AND scheduled_at IS NULL AND completed_at IS NULL) "
            "OR (activity_type IN ('FOLLOW_UP', 'INTERVIEW') AND scheduled_at IS NOT NULL)",
            name="ck_application_activities_schedule",
        ),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "application_id",
            "idempotency_key",
            name="uq_application_activities_idempotency",
        ),
    )
    op.create_index(
        "ix_application_activities_application_id",
        "application_activities",
        ["application_id"],
    )
    op.create_index(
        "ix_application_activities_scheduled_at",
        "application_activities",
        ["scheduled_at"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_application_activities_scheduled_at",
        table_name="application_activities",
    )
    op.drop_index(
        "ix_application_activities_application_id",
        table_name="application_activities",
    )
    op.drop_table("application_activities")
