"""Add job capture, immutable snapshots, and grounded requirements.

Revision ID: 0005_m4_job_capture
Revises: 0004_m2_m3_resume_ingestion
Create Date: 2026-09-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0005_m4_job_capture"
down_revision: str | None = "0004_m2_m3_resume_ingestion"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "jobs",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("company", sa.String(500), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("location", sa.String(500), nullable=True),
        sa.Column("source_url", sa.String(2000), nullable=True),
        sa.Column("application_url", sa.String(2000), nullable=True),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column(
            "captured_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_jobs_user_id", "jobs", ["user_id"])

    op.create_table(
        "job_snapshots",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column("job_id", sa.Uuid, sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("raw_description", sa.Text, nullable=False),
        sa.Column("normalized_description", sa.Text, nullable=False),
        sa.Column("content_sha256", sa.String(64), nullable=False),
        sa.Column("parser_version", sa.String(100), nullable=False),
        sa.Column("parser_model", sa.String(100), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("job_id", "version_number"),
    )
    op.create_index("ix_job_snapshots_job_id", "job_snapshots", ["job_id"])

    op.create_table(
        "job_requirements",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "job_snapshot_id",
            sa.Uuid,
            sa.ForeignKey("job_snapshots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("category", sa.String(50), nullable=False),
        sa.Column("description", sa.Text, nullable=False),
        sa.Column("normalized_value", sa.String(500), nullable=True),
        sa.Column("importance", sa.String(50), nullable=False),
        sa.Column("source_text", sa.Text, nullable=False),
        sa.Column("confidence", sa.String(50), nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("job_snapshot_id", "position"),
    )
    op.create_index("ix_job_requirements_snapshot_id", "job_requirements", ["job_snapshot_id"])


def downgrade() -> None:
    op.drop_table("job_requirements")
    op.drop_table("job_snapshots")
    op.drop_table("jobs")
