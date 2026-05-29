from datetime import date as date_type
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fixture import Fixture, FixtureStatus
from app.repositories.fixture import FixtureRepository
from app.repositories.league import LeagueRepository
from app.repositories.team import TeamRepository
from app.schemas.fixtures import FixtureResponse
from app.services.cache import JsonCache
from app.services.football_api import APIFootballClient, FixtureRow

_API_STATUS_MAP = {
    "TBD": FixtureStatus.SCHEDULED,
    "NS": FixtureStatus.SCHEDULED,
    "1H": FixtureStatus.LIVE,
    "HT": FixtureStatus.LIVE,
    "2H": FixtureStatus.LIVE,
    "ET": FixtureStatus.LIVE,
    "BT": FixtureStatus.LIVE,
    "P": FixtureStatus.LIVE,
    "SUSP": FixtureStatus.LIVE,
    "INT": FixtureStatus.LIVE,
    "LIVE": FixtureStatus.LIVE,
    "FT": FixtureStatus.FINISHED,
    "AET": FixtureStatus.FINISHED,
    "PEN": FixtureStatus.FINISHED,
    "AWD": FixtureStatus.FINISHED,
    "WO": FixtureStatus.FINISHED,
    "PST": FixtureStatus.POSTPONED,
    "CANC": FixtureStatus.CANCELLED,
    "ABD": FixtureStatus.CANCELLED,
}


def map_api_status(short: str) -> FixtureStatus:
    return _API_STATUS_MAP.get(short, FixtureStatus.SCHEDULED)


def current_season(today: date_type) -> int:
    return today.year if today.month >= 7 else today.year - 1


def _ttl_for_fixtures(fixtures: list[Fixture]) -> int:
    if not fixtures:
        return 300
    if any(f.status == FixtureStatus.LIVE for f in fixtures):
        return 30
    if all(f.status == FixtureStatus.FINISHED for f in fixtures):
        return 24 * 3600
    return 3600


class FixturesService:
    def __init__(
        self,
        *,
        db: AsyncSession,
        cache: JsonCache,
        client: APIFootballClient,
    ) -> None:
        self._db = db
        self._cache = cache
        self._client = client

    async def list_for_league_and_date(
        self, *, league_id: int, season: int, match_date: date_type
    ) -> list[FixtureResponse]:
        cache_key = f"acca:fixtures:{league_id}:{match_date.isoformat()}"

        cached = await self._cache.get(cache_key)
        if cached is not None:
            return [FixtureResponse.model_validate(item) for item in cached]

        rows = await self._client.fixtures_by_league_and_date(
            league_id=league_id, season=season, match_date=match_date
        )
        if not rows:
            await self._cache.set(cache_key, [], ttl_seconds=300)
            return []

        fixtures = await self._sync_to_db(rows)
        responses = [FixtureResponse.model_validate(f) for f in fixtures]

        serialised = [r.model_dump(mode="json") for r in responses]
        await self._cache.set(cache_key, serialised, ttl_seconds=_ttl_for_fixtures(fixtures))
        return responses

    async def _sync_to_db(self, rows: list[FixtureRow]) -> list[Fixture]:
        league_repo = LeagueRepository(self._db)
        team_repo = TeamRepository(self._db)
        fixture_repo = FixtureRepository(self._db)

        league_data = rows[0].league
        league = await league_repo.upsert(
            api_id=league_data.id,
            name=league_data.name,
            country=league_data.country,
            logo_url=league_data.logo,
        )

        team_inputs: dict[int, tuple[int, str, str | None]] = {}
        for row in rows:
            team_inputs[row.teams.home.id] = (
                row.teams.home.id,
                row.teams.home.name,
                row.teams.home.logo,
            )
            team_inputs[row.teams.away.id] = (
                row.teams.away.id,
                row.teams.away.name,
                row.teams.away.logo,
            )
        teams_by_api_id = await team_repo.upsert_many(team_inputs.values())

        fixtures: list[Fixture] = []
        for row in rows:
            kickoff = datetime.fromisoformat(row.fixture.date)
            fixture = await fixture_repo.upsert(
                api_id=row.fixture.id,
                league_id=league.id,
                home_team_id=teams_by_api_id[row.teams.home.id].id,
                away_team_id=teams_by_api_id[row.teams.away.id].id,
                kickoff_at=kickoff,
                status=map_api_status(row.fixture.status.short),
                home_goals=row.goals.home,
                away_goals=row.goals.away,
            )
            fixtures.append(fixture)

        await self._db.commit()
        for fixture in fixtures:
            await self._db.refresh(fixture)
        return fixtures
