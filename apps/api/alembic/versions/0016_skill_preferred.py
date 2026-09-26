"""Add preferred flag to skills.

Revision ID: 0016_skill_preferred
Revises: 0015_simplify_contact_name
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0016_skill_preferred"
down_revision: str | None = "0015_simplify_contact_name"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "skills",
        sa.Column("preferred", sa.Boolean(), nullable=False, server_default=sa.false()),
    )


def downgrade() -> None:
    op.drop_column("skills", "preferred")
