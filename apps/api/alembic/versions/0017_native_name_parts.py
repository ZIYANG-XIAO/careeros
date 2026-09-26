"""Add explicit native-script given and family names.

Revision ID: 0017_native_name_parts
Revises: 0016_skill_preferred
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0017_native_name_parts"
down_revision: str | None = "0016_skill_preferred"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("user_contact_info", sa.Column("given_name_native", sa.String(100)))
    op.add_column("user_contact_info", sa.Column("family_name_native", sa.String(100)))


def downgrade() -> None:
    op.drop_column("user_contact_info", "family_name_native")
    op.drop_column("user_contact_info", "given_name_native")
