"""Add reproducible evidence matching and resume representation.

Revision ID: 0006_m5_m6_job_intelligence
Revises: 0005_m4_job_capture
Create Date: 2026-09-22
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0006_m5_m6_job_intelligence"
down_revision: str | None = "0005_m4_job_capture"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "job_analyses",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id", sa.Uuid, sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False
        ),
        sa.Column("job_id", sa.Uuid, sa.ForeignKey("jobs.id", ondelete="CASCADE"), nullable=False),
        sa.Column(
            "job_snapshot_id",
            sa.Uuid,
            sa.ForeignKey("job_snapshots.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "career_brain_id",
            sa.Uuid,
            sa.ForeignKey("career_brains.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "resume_version_id",
            sa.Uuid,
            sa.ForeignKey("resume_versions.id"),
            nullable=False,
        ),
        sa.Column("analysis_version", sa.Integer, nullable=False),
        sa.Column("matcher_version", sa.String(100), nullable=False),
        sa.Column("matcher_model", sa.String(100), nullable=False),
        sa.Column("overall_recommendation", sa.String(50), nullable=False),
        sa.Column("summary", sa.Text, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("job_id", "analysis_version"),
    )
    op.create_index("ix_job_analyses_user_id", "job_analyses", ["user_id"])
    op.create_index("ix_job_analyses_job_id", "job_analyses", ["job_id"])

    op.create_table(
        "evidence_matches",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "job_analysis_id",
            sa.Uuid,
            sa.ForeignKey("job_analyses.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "job_requirement_id",
            sa.Uuid,
            sa.ForeignKey("job_requirements.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("support_strength", sa.String(50), nullable=False),
        sa.Column("resume_representation", sa.String(50), nullable=False),
        sa.Column("classification", sa.String(50), nullable=False),
        sa.Column("explanation", sa.Text, nullable=False),
        sa.Column("resume_source_text", sa.Text, nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("job_analysis_id", "job_requirement_id"),
    )
    op.create_index("ix_evidence_matches_analysis_id", "evidence_matches", ["job_analysis_id"])

    op.create_table(
        "evidence_match_references",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "evidence_match_id",
            sa.Uuid,
            sa.ForeignKey("evidence_matches.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("career_evidence_id", sa.Uuid, nullable=False),
        sa.Column("career_evidence_revision_id", sa.Uuid, nullable=False),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("source_id", sa.Uuid, nullable=False),
        sa.Column("evidence_content", sa.Text, nullable=False),
        sa.Column("revision_number", sa.Integer, nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("evidence_match_id", "career_evidence_revision_id"),
    )
    op.create_index(
        "ix_match_references_match_id", "evidence_match_references", ["evidence_match_id"]
    )


def downgrade() -> None:
    op.drop_table("evidence_match_references")
    op.drop_table("evidence_matches")
    op.drop_table("job_analyses")
