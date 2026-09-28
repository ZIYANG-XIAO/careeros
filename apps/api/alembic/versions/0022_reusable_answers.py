"""Add explicitly saved reusable answers for custom application questions.

Revision ID: 0022_reusable_answers
Revises: 0021_job_search_goals
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0022_reusable_answers"
down_revision: str | None = "0021_job_search_goals"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "reusable_answers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("question_text", sa.String(length=500), nullable=False),
        sa.Column("question_key", sa.String(length=500), nullable=False),
        sa.Column("answer_text", sa.String(length=2000), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column("revoked_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_reusable_answers_user_id", "reusable_answers", ["user_id"])
    op.create_index(
        "uq_reusable_answers_active_question",
        "reusable_answers",
        ["user_id", "question_key"],
        unique=True,
        postgresql_where=sa.text("revoked_at IS NULL"),
    )


def downgrade() -> None:
    op.drop_index("uq_reusable_answers_active_question", table_name="reusable_answers")
    op.drop_index("ix_reusable_answers_user_id", table_name="reusable_answers")
    op.drop_table("reusable_answers")
