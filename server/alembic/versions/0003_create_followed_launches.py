"""create followed launches table

Revision ID: 0003
Revises: 0002
Create Date: 2026-07-19

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0003"
down_revision: str | None = "0002"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "followed_launches",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("launch_id", sa.String(200), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("net", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status_name", sa.String(100), nullable=False),
        sa.Column("status_abbrev", sa.String(30), nullable=False),
        sa.Column("provider", sa.String(200)),
        sa.Column("image", sa.Text()),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
        sa.UniqueConstraint("user_id", "launch_id", name="uq_followed_launch_user_launch"),
    )
    op.create_index("ix_followed_launches_user_id", "followed_launches", ["user_id"])
    op.create_index("ix_followed_launches_user_net", "followed_launches", ["user_id", "net"])


def downgrade() -> None:
    op.drop_index("ix_followed_launches_user_net", table_name="followed_launches")
    op.drop_index("ix_followed_launches_user_id", table_name="followed_launches")
    op.drop_table("followed_launches")
