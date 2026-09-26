"""Add USER_CONTACT_INFO to application_answers source_category constraint.

Revision ID: 0013_uci_answer_source
Revises: 0012_user_contact_info
Create Date: 2026-09-26

DATA PREREQUISITE — Downgrade:
    The downgrade removes USER_CONTACT_INFO from the check constraint.
    If any application_answers rows have source_category='USER_CONTACT_INFO',
    the downgrade will fail with a check-constraint violation.
    Before downgrading, either delete or reclassify those rows manually.
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0013_uci_answer_source"
down_revision: str | None = "0012_user_contact_info"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_application_answers_source",
        "application_answers",
        type_="check",
    )
    op.create_check_constraint(
        "ck_application_answers_source",
        "application_answers",
        "source_category IN ("
        "'IDENTITY', 'CAREER_BRAIN', 'RESUME_VERSION', "
        "'USER_PROVIDED', 'USER_CONTACT_INFO')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_application_answers_source",
        "application_answers",
        type_="check",
    )
    op.create_check_constraint(
        "ck_application_answers_source",
        "application_answers",
        "source_category IN ('IDENTITY', 'CAREER_BRAIN', 'RESUME_VERSION', 'USER_PROVIDED')",
    )
