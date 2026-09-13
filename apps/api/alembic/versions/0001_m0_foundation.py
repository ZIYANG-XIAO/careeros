"""Establish the M0 migration baseline.

Revision ID: 0001_m0_foundation
Revises:
Create Date: 2026-09-13
"""

from collections.abc import Sequence

revision: str = "0001_m0_foundation"
down_revision: str | None = None
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    """Create no product tables; Alembic records this infrastructure baseline."""


def downgrade() -> None:
    """The infrastructure-only baseline has no schema objects to remove."""
