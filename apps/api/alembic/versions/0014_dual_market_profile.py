"""Add dual-market profile semantics.

Revision ID: 0014_dual_market_profile
Revises: 0013_uci_answer_source
Create Date: 2026-09-26
"""

from collections.abc import Sequence

import sqlalchemy as sa

from alembic import op

revision: str = "0014_dual_market_profile"
down_revision: str | None = "0013_uci_answer_source"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("user_contact_info", sa.Column("full_name_native", sa.String(200)))
    op.add_column("user_contact_info", sa.Column("full_name_latin", sa.String(200)))
    op.add_column(
        "user_contact_info",
        sa.Column("name_order", sa.String(20), nullable=False, server_default="UNKNOWN"),
    )
    op.add_column("user_contact_info", sa.Column("contact_email", sa.String(255)))
    op.add_column("user_contact_info", sa.Column("wechat_id", sa.String(100)))
    op.add_column("user_contact_info", sa.Column("district", sa.String(100)))
    op.add_column("user_contact_info", sa.Column("github_url", sa.String(2000)))
    op.create_check_constraint(
        "ck_user_contact_info_name_order",
        "user_contact_info",
        "name_order IN ('UNKNOWN', 'GIVEN_FAMILY', 'FAMILY_GIVEN')",
    )


def downgrade() -> None:
    op.drop_constraint("ck_user_contact_info_name_order", "user_contact_info", type_="check")
    op.drop_column("user_contact_info", "github_url")
    op.drop_column("user_contact_info", "district")
    op.drop_column("user_contact_info", "wechat_id")
    op.drop_column("user_contact_info", "contact_email")
    op.drop_column("user_contact_info", "name_order")
    op.drop_column("user_contact_info", "full_name_latin")
    op.drop_column("user_contact_info", "full_name_native")
