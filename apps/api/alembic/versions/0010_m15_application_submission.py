"""Support idempotent application submission recording.

Revision ID: 0010_m15_application_submission
Revises: 0009_m14_application_memory
Create Date: 2026-09-25
"""

from collections.abc import Sequence

from alembic import op

revision: str = "0010_m15_application_submission"
down_revision: str | None = "0009_m14_application_memory"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.drop_constraint(
        "ck_application_operations_type",
        "application_operations",
        type_="check",
    )
    op.create_check_constraint(
        "ck_application_operations_type",
        "application_operations",
        "operation_type IN ('STATUS_UPDATE', 'RECORD_SUBMISSION')",
    )


def downgrade() -> None:
    op.drop_constraint(
        "ck_application_operations_type",
        "application_operations",
        type_="check",
    )
    op.execute("DELETE FROM application_operations WHERE operation_type = 'RECORD_SUBMISSION'")
    op.create_check_constraint(
        "ck_application_operations_type",
        "application_operations",
        "operation_type = 'STATUS_UPDATE'",
    )
