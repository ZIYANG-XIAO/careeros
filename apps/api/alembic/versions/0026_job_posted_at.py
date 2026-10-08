"""Add the source-reported publish time to jobs.

Revision ID: 0026_job_posted_at
Revises: 0025_job_feedback
Create Date: 2026-10-02
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0026_job_posted_at"
down_revision: str | None = "0025_job_feedback"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("jobs", sa.Column("posted_at", sa.DateTime(timezone=True), nullable=True))
    op.create_index("ix_jobs_posted_at", "jobs", ["posted_at"])


def downgrade() -> None:
    op.drop_index("ix_jobs_posted_at", table_name="jobs")
    op.drop_column("jobs", "posted_at")
