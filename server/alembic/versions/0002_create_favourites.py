"""create favourites table

Revision ID: 0002
Revises: 0001
Create Date: 2026-06-06

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0002"
down_revision: str | None = "0001"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "favourites",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("kind", sa.String(20), nullable=False),
        sa.Column("ref_id", sa.String(200), nullable=False),
        sa.Column("payload", sa.JSON(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "kind", "ref_id", name="uq_favourite_user_kind_ref"),
    )
    op.create_index("ix_favourites_user_id", "favourites", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_favourites_user_id", table_name="favourites")
    op.drop_table("favourites")
