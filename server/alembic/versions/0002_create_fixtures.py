"""create leagues, teams, fixtures

Revision ID: 0002
Revises: 0001
Create Date: 2026-05-28

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
        "leagues",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("api_football_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("country", sa.String(80), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=True),
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
    op.create_index("ix_leagues_api_football_id", "leagues", ["api_football_id"], unique=True)

    op.create_table(
        "teams",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("api_football_id", sa.Integer(), nullable=False),
        sa.Column("name", sa.String(120), nullable=False),
        sa.Column("logo_url", sa.String(500), nullable=True),
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
    op.create_index("ix_teams_api_football_id", "teams", ["api_football_id"], unique=True)

    op.create_table(
        "fixtures",
        sa.Column("id", sa.Integer(), primary_key=True, autoincrement=True),
        sa.Column("api_football_id", sa.Integer(), nullable=False),
        sa.Column("league_id", sa.Integer(), sa.ForeignKey("leagues.id"), nullable=False),
        sa.Column("home_team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("away_team_id", sa.Integer(), sa.ForeignKey("teams.id"), nullable=False),
        sa.Column("kickoff_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("status", sa.String(20), nullable=False),
        sa.Column("home_goals", sa.Integer(), nullable=True),
        sa.Column("away_goals", sa.Integer(), nullable=True),
        sa.Column(
            "last_synced_at",
            sa.DateTime(timezone=True),
            nullable=False,
            server_default=sa.func.now(),
        ),
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
    op.create_index("ix_fixtures_api_football_id", "fixtures", ["api_football_id"], unique=True)
    op.create_index("ix_fixtures_league_id", "fixtures", ["league_id"])
    op.create_index("ix_fixtures_home_team_id", "fixtures", ["home_team_id"])
    op.create_index("ix_fixtures_away_team_id", "fixtures", ["away_team_id"])
    op.create_index("ix_fixtures_kickoff_at", "fixtures", ["kickoff_at"])


def downgrade() -> None:
    op.drop_index("ix_fixtures_kickoff_at", table_name="fixtures")
    op.drop_index("ix_fixtures_away_team_id", table_name="fixtures")
    op.drop_index("ix_fixtures_home_team_id", table_name="fixtures")
    op.drop_index("ix_fixtures_league_id", table_name="fixtures")
    op.drop_index("ix_fixtures_api_football_id", table_name="fixtures")
    op.drop_table("fixtures")
    op.drop_index("ix_teams_api_football_id", table_name="teams")
    op.drop_table("teams")
    op.drop_index("ix_leagues_api_football_id", table_name="leagues")
    op.drop_table("leagues")
