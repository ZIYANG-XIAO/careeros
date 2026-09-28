"""Add user-entered contacts per application.

Revision ID: 0023_application_contacts
Revises: 0022_reusable_answers
Create Date: 2026-09-28
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0023_application_contacts"
down_revision: str | None = "0022_reusable_answers"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "application_contacts",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("application_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("relationship_type", sa.String(length=50), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=True),
        sa.Column("profile_url", sa.String(length=2000), nullable=True),
        sa.Column("notes", sa.Text(), nullable=True),
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
            "relationship_type IN "
            "('RECRUITER', 'HIRING_MANAGER', 'INTERVIEWER', 'REFERRER', 'OTHER')",
            name="ck_application_contacts_relationship_type",
        ),
        sa.ForeignKeyConstraint(["application_id"], ["applications.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_application_contacts_application_id", "application_contacts", ["application_id"]
    )


def downgrade() -> None:
    op.drop_index("ix_application_contacts_application_id", table_name="application_contacts")
    op.drop_table("application_contacts")
