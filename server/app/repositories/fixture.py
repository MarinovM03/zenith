from datetime import UTC, datetime, time
from datetime import date as date_type

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fixture import Fixture, FixtureStatus


class FixtureRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert(
        self,
        *,
        external_id: int,
        league_id: int,
        home_team_id: int,
        away_team_id: int,
        kickoff_at: datetime,
        status: FixtureStatus,
        home_goals: int | None,
        away_goals: int | None,
    ) -> Fixture:
        existing = await self._db.execute(select(Fixture).where(Fixture.external_id == external_id))
        fixture = existing.scalar_one_or_none()

        if fixture is None:
            fixture = Fixture(
                external_id=external_id,
                league_id=league_id,
                home_team_id=home_team_id,
                away_team_id=away_team_id,
                kickoff_at=kickoff_at,
                status=status,
                home_goals=home_goals,
                away_goals=away_goals,
            )
            self._db.add(fixture)
        else:
            fixture.league_id = league_id
            fixture.home_team_id = home_team_id
            fixture.away_team_id = away_team_id
            fixture.kickoff_at = kickoff_at
            fixture.status = status
            fixture.home_goals = home_goals
            fixture.away_goals = away_goals
            fixture.last_synced_at = datetime.now(UTC)

        await self._db.flush()
        return fixture

    async def get_by_ids(self, fixture_ids: list[int]) -> dict[int, Fixture]:
        if not fixture_ids:
            return {}
        result = await self._db.execute(select(Fixture).where(Fixture.id.in_(fixture_ids)))
        return {f.id: f for f in result.scalars()}

    async def list_by_league_and_date(
        self, *, league_id: int, match_date: date_type
    ) -> list[Fixture]:
        start = datetime.combine(match_date, time.min).replace(tzinfo=UTC)
        end = datetime.combine(match_date, time.max).replace(tzinfo=UTC)

        result = await self._db.execute(
            select(Fixture)
            .where(Fixture.league_id == league_id)
            .where(Fixture.kickoff_at >= start)
            .where(Fixture.kickoff_at <= end)
            .order_by(Fixture.kickoff_at)
        )
        return list(result.scalars())
