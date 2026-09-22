"""Add resume ingestion, assets, and immutable versions.

Revision ID: 0004_m2_m3_resume_ingestion
Revises: 0003_m1b_entities_evidence
Create Date: 2026-09-20
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0004_m2_m3_resume_ingestion"
down_revision: str | None = "0003_m1b_entities_evidence"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "resumes",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id",
            sa.Uuid,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("type", sa.String(50), nullable=False),
        sa.Column("is_primary", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_resumes_user_id", "resumes", ["user_id"])

    op.create_table(
        "resume_assets",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id",
            sa.Uuid,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("storage_key", sa.String(255), nullable=False, unique=True),
        sa.Column("original_filename", sa.String(500), nullable=False),
        sa.Column("content_type", sa.String(100), nullable=False),
        sa.Column("size_bytes", sa.BigInteger, nullable=False),
        sa.Column("sha256", sa.String(64), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_resume_assets_user_id", "resume_assets", ["user_id"])

    op.create_table(
        "resume_versions",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "resume_id",
            sa.Uuid,
            sa.ForeignKey("resumes.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "asset_id",
            sa.Uuid,
            sa.ForeignKey("resume_assets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("version_number", sa.Integer, nullable=False),
        sa.Column("source", sa.String(50), nullable=False),
        sa.Column("created_by", sa.String(50), nullable=False),
        sa.Column(
            "source_version_id",
            sa.Uuid,
            sa.ForeignKey("resume_versions.id", ondelete="SET NULL"),
            nullable=True,
        ),
        sa.Column("extracted_text", sa.Text, nullable=False),
        sa.Column("structured_content", sa.JSON, nullable=False),
        sa.Column("parser_version", sa.String(100), nullable=False),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.UniqueConstraint("resume_id", "version_number"),
    )
    op.create_index("ix_resume_versions_resume_id", "resume_versions", ["resume_id"])

    op.create_table(
        "resume_imports",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "user_id",
            sa.Uuid,
            sa.ForeignKey("users.id", ondelete="CASCADE"),
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
            sa.ForeignKey("resume_versions.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("error_code", sa.String(100), nullable=True),
        sa.Column("error_message", sa.Text, nullable=True),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index("ix_resume_imports_user_id", "resume_imports", ["user_id"])
    op.create_index("ix_resume_imports_career_brain_id", "resume_imports", ["career_brain_id"])

    op.create_table(
        "resume_draft_items",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "resume_import_id",
            sa.Uuid,
            sa.ForeignKey("resume_imports.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column(
            "parent_item_id",
            sa.Uuid,
            sa.ForeignKey("resume_draft_items.id", ondelete="CASCADE"),
            nullable=True,
        ),
        sa.Column("item_type", sa.String(50), nullable=False),
        sa.Column("data", sa.JSON, nullable=False),
        sa.Column("position", sa.Integer, nullable=False),
        sa.Column("status", sa.String(50), nullable=False),
        sa.Column("materialized_source_type", sa.String(50), nullable=True),
        sa.Column("materialized_source_id", sa.Uuid, nullable=True),
        sa.Column(
            "evidence_id",
            sa.Uuid,
            sa.ForeignKey("career_evidence.id", ondelete="CASCADE"),
            nullable=False,
            unique=True,
        ),
        sa.Column(
            "created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
        sa.Column(
            "updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False
        ),
    )
    op.create_index(
        "ix_resume_draft_items_resume_import_id", "resume_draft_items", ["resume_import_id"]
    )
    op.create_index(
        "ix_resume_draft_items_parent_item_id", "resume_draft_items", ["parent_item_id"]
    )


def downgrade() -> None:
    op.drop_table("resume_draft_items")
    op.drop_table("resume_imports")
    op.drop_table("resume_versions")
    op.drop_table("resume_assets")
    op.drop_table("resumes")
