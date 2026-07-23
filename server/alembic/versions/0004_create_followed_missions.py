"""create followed missions table

Revision ID: 0004
Revises: 0003
Create Date: 2026-07-23

"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "0004"
down_revision: str | None = "0003"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "followed_missions",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "user_id",
            sa.Uuid(),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("mission_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(500), nullable=False),
        sa.Column("description", sa.Text()),
        sa.Column("launch_id", sa.String(200), nullable=False),
        sa.Column("launch_name", sa.String(500), nullable=False),
        sa.Column("net", sa.DateTime(timezone=True), nullable=False),
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
        sa.UniqueConstraint("user_id", "mission_id", name="uq_followed_mission_user_mission"),
    )
    op.create_index("ix_followed_missions_user_id", "followed_missions", ["user_id"])
    op.create_index("ix_followed_missions_user_net", "followed_missions", ["user_id", "net"])


def downgrade() -> None:
    op.drop_index("ix_followed_missions_user_net", table_name="followed_missions")
    op.drop_index("ix_followed_missions_user_id", table_name="followed_missions")
    op.drop_table("followed_missions")
