"""Simplify UserContactInfo name fields.

Revision ID: 0015_simplify_contact_name
Revises: 0014_dual_market_profile
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0015_simplify_contact_name"
down_revision: str | None = "0014_dual_market_profile"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint("ck_user_contact_info_name_order", "user_contact_info", type_="check")
    op.drop_column("user_contact_info", "name_order")
    op.drop_column("user_contact_info", "full_name_latin")


def downgrade() -> None:
    op.add_column("user_contact_info", sa.Column("full_name_latin", sa.String(200)))
    op.add_column(
        "user_contact_info",
        sa.Column("name_order", sa.String(20), nullable=False, server_default="UNKNOWN"),
    )
    op.create_check_constraint(
        "ck_user_contact_info_name_order",
        "user_contact_info",
        "name_order IN ('UNKNOWN', 'GIVEN_FAMILY', 'FAMILY_GIVEN')",
    )
