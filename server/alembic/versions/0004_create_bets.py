"""create bets and bet_legs

Revision ID: 0004
Revises: 0003
Create Date: 2026-05-29

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
        "bets",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column("user_id", sa.Uuid(), sa.ForeignKey("users.id"), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
        sa.Column("stake", sa.Numeric(10, 2), nullable=True),
        sa.Column("odds", sa.Numeric(10, 2), nullable=True),
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
    )
    op.create_index("ix_bets_user_id", "bets", ["user_id"])

    op.create_table(
        "bet_legs",
        sa.Column("id", sa.Uuid(), primary_key=True),
        sa.Column(
            "bet_id",
            sa.Uuid(),
            sa.ForeignKey("bets.id", ondelete="CASCADE"),
            nullable=False,
        ),
        sa.Column("fixture_id", sa.Integer(), sa.ForeignKey("fixtures.id"), nullable=False),
        sa.Column("kind", sa.String(40), nullable=False),
        sa.Column("params", sa.JSON(), nullable=False),
        sa.Column("status", sa.String(20), nullable=False, server_default="pending"),
    )
    op.create_index("ix_bet_legs_bet_id", "bet_legs", ["bet_id"])
    op.create_index("ix_bet_legs_fixture_id", "bet_legs", ["fixture_id"])


def downgrade() -> None:
    op.drop_index("ix_bet_legs_fixture_id", table_name="bet_legs")
    op.drop_index("ix_bet_legs_bet_id", table_name="bet_legs")
    op.drop_table("bet_legs")
    op.drop_index("ix_bets_user_id", table_name="bets")
    op.drop_table("bets")
