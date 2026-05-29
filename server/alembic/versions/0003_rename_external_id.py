"""rename api_football_id to external_id

Revision ID: 0003
Revises: 0002
Create Date: 2026-05-29

"""

from collections.abc import Sequence

from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None

_TABLES = ("leagues", "teams", "fixtures")


def upgrade() -> None:
    for table in _TABLES:
        op.alter_column(table, "api_football_id", new_column_name="external_id")
        op.drop_index(f"ix_{table}_api_football_id", table_name=table)
        op.create_index(f"ix_{table}_external_id", table, ["external_id"], unique=True)


def downgrade() -> None:
    for table in _TABLES:
        op.drop_index(f"ix_{table}_external_id", table_name=table)
        op.alter_column(table, "external_id", new_column_name="api_football_id")
        op.create_index(f"ix_{table}_api_football_id", table, ["api_football_id"], unique=True)
