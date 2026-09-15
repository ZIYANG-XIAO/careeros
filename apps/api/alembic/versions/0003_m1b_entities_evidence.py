"""Create career entity and evidence tables.

Revision ID: 0003_m1b_entities_evidence
Revises: 0002_m1a_users_and_career_brains
Create Date: 2026-09-14
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0003_m1b_entities_evidence"
down_revision: str | None = "0002_m1a_users_and_career_brains"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    # --- container entities ---

    op.create_table(
        "educations",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "career_brain_id",
            sa.Uuid,
            sa.ForeignKey("career_brains.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("institution", sa.String(500), nullable=False),
        sa.Column("degree", sa.String(500), nullable=True),
        sa.Column("field_of_study", sa.String(500), nullable=True),
        sa.Column("location", sa.String(500), nullable=True),
        sa.Column("start_date", sa.String(10), nullable=True),
        sa.Column("end_date", sa.String(10), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_educations_career_brain_id", "educations", ["career_brain_id"])

    op.create_table(
        "experiences",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "career_brain_id",
            sa.Uuid,
            sa.ForeignKey("career_brains.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("company", sa.String(500), nullable=False),
        sa.Column("title", sa.String(500), nullable=False),
        sa.Column("location", sa.String(500), nullable=True),
        sa.Column("start_date", sa.String(10), nullable=True),
        sa.Column("end_date", sa.String(10), nullable=True),
        sa.Column("is_current", sa.Boolean, nullable=False, server_default="false"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_experiences_career_brain_id", "experiences", ["career_brain_id"])

    op.create_table(
        "projects",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "career_brain_id",
            sa.Uuid,
            sa.ForeignKey("career_brains.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("description", sa.Text, nullable=True),
        sa.Column("url", sa.String(2000), nullable=True),
        sa.Column("start_date", sa.String(10), nullable=True),
        sa.Column("end_date", sa.String(10), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_projects_career_brain_id", "projects", ["career_brain_id"])

    op.create_table(
        "skills",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "career_brain_id",
            sa.Uuid,
            sa.ForeignKey("career_brains.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_skills_career_brain_id", "skills", ["career_brain_id"])

    # --- detail entities ---

    op.create_table(
        "experience_details",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "experience_id",
            sa.Uuid,
            sa.ForeignKey("experiences.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_experience_details_experience_id", "experience_details", ["experience_id"])

    op.create_table(
        "project_details",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "project_id",
            sa.Uuid,
            sa.ForeignKey("projects.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
    )
    op.create_index("ix_project_details_project_id", "project_details", ["project_id"])

    # --- evidence ---

    op.create_table(
        "career_evidence",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "career_brain_id",
            sa.Uuid,
            sa.ForeignKey("career_brains.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("source_type", sa.String(50), nullable=False),
        sa.Column("source_id", sa.Uuid, nullable=False),
        # No FK — avoids circular dependency with career_evidence_revisions.
        # Application code guarantees this points to a revision of the same evidence.
        sa.Column("current_revision_id", sa.Uuid, nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("source_type", "source_id"),
    )
    op.create_index("ix_career_evidence_career_brain_id", "career_evidence", ["career_brain_id"])

    op.create_table(
        "career_evidence_revisions",
        sa.Column("id", sa.Uuid, primary_key=True, server_default=sa.text("gen_random_uuid()")),
        sa.Column(
            "evidence_id",
            sa.Uuid,
            sa.ForeignKey("career_evidence.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("revision_number", sa.Integer, nullable=False),
        sa.Column("content", sa.Text, nullable=False),
        sa.Column("origin", sa.String(50), nullable=False),
        sa.Column("confirmation_status", sa.String(50), nullable=False),
        sa.Column("created_by", sa.String(50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.UniqueConstraint("evidence_id", "revision_number"),
    )
    op.create_index(
        "ix_career_evidence_revisions_evidence_id",
        "career_evidence_revisions",
        ["evidence_id"],
    )


def downgrade() -> None:
    op.drop_table("career_evidence_revisions")
    op.drop_table("career_evidence")
    op.drop_table("project_details")
    op.drop_table("experience_details")
    op.drop_table("skills")
    op.drop_table("projects")
    op.drop_table("experiences")
    op.drop_table("educations")
