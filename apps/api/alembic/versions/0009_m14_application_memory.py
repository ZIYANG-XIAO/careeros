"""Add durable Application Memory.

Revision ID: 0009_m14_application_memory
Revises: 0008_m9_job_source_boundary
Create Date: 2026-09-25
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0009_m14_application_memory"
down_revision: str | None = "0008_m9_job_source_boundary"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "applications",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("job_id", sa.Uuid(), nullable=True),
        sa.Column("resume_version_id", sa.Uuid(), nullable=True),
        sa.Column("origin", sa.String(length=50), nullable=False),
        sa.Column("company_snapshot", sa.String(length=500), nullable=False),
        sa.Column("role_snapshot", sa.String(length=500), nullable=False),
        sa.Column("application_url_snapshot", sa.String(length=2000), nullable=True),
        sa.Column("source_snapshot", sa.String(length=100), nullable=False),
        sa.Column("status", sa.String(length=50), nullable=False),
        sa.Column("applied_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "status_updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.Column("idempotency_key", sa.Uuid(), nullable=False),
        sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
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
        sa.CheckConstraint(
            "status IN ('PREPARING', 'APPLIED', 'ASSESSMENT', 'INTERVIEW', "
            "'FINAL', 'REJECTED', 'OFFER', 'WITHDRAWN')",
            name="ck_applications_status",
        ),
        sa.CheckConstraint(
            "origin IN ('CAREEROS_JOB', 'EXTERNAL_PAGE', 'MANUAL')",
            name="ck_applications_origin",
        ),
        sa.ForeignKeyConstraint(["job_id"], ["jobs.id"], ondelete="SET NULL"),
        sa.ForeignKeyConstraint(["resume_version_id"], ["resume_versions.id"]),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "idempotency_key"),
    )
    op.create_index("ix_applications_user_id", "applications", ["user_id"])
    op.create_index("ix_applications_user_status", "applications", ["user_id", "status"])
    op.create_index("ix_applications_job_id", "applications", ["job_id"])
    op.create_index("ix_applications_resume_version_id", "applications", ["resume_version_id"])

    op.create_table(
        "application_answers",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("canonical_key", sa.String(length=100), nullable=True),
        sa.Column("question_text", sa.String(length=500), nullable=False),
        sa.Column("answer_text", sa.Text(), nullable=False),
        sa.Column("source_category", sa.String(length=50), nullable=False),
        sa.Column("policy_category", sa.String(length=50), nullable=False),
        sa.Column("sensitivity", sa.String(length=50), nullable=False),
        sa.Column("position", sa.Integer(), nullable=False),
        sa.Column("confirmed_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "source_category IN ('IDENTITY', 'CAREER_BRAIN', 'RESUME_VERSION', 'USER_PROVIDED')",
            name="ck_application_answers_source",
        ),
        sa.CheckConstraint("policy_category = 'STANDARD'", name="ck_application_answers_policy"),
        sa.CheckConstraint("sensitivity = 'NONE'", name="ck_application_answers_sensitivity"),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("application_id", "position"),
    )
    op.create_index(
        "ix_application_answers_application_id",
        "application_answers",
        ["application_id"],
    )

    op.create_table(
        "application_operations",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("idempotency_key", sa.Uuid(), nullable=False),
        sa.Column("request_fingerprint", sa.String(length=64), nullable=False),
        sa.Column("operation_type", sa.String(length=50), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "operation_type = 'STATUS_UPDATE'",
            name="ck_application_operations_type",
        ),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "idempotency_key"),
    )
    op.create_index(
        "ix_application_operations_application_id",
        "application_operations",
        ["application_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_application_operations_application_id",
        table_name="application_operations",
    )
    op.drop_table("application_operations")
    op.drop_index("ix_application_answers_application_id", table_name="application_answers")
    op.drop_table("application_answers")
    op.drop_index("ix_applications_resume_version_id", table_name="applications")
    op.drop_index("ix_applications_job_id", table_name="applications")
    op.drop_index("ix_applications_user_status", table_name="applications")
    op.drop_index("ix_applications_user_id", table_name="applications")
    op.drop_table("applications")
