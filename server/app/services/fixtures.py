import logging
from datetime import date as date_type
from datetime import datetime

from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fixture import Fixture, FixtureStatus
from app.repositories.fixture import FixtureRepository
from app.repositories.league import LeagueRepository
from app.repositories.team import TeamRepository
from app.schemas.fixtures import FixtureResponse
from app.services.cache import JsonCache
from app.services.football_data import FootballDataClient, FootballDataError, ParsedFixture

logger = logging.getLogger(__name__)

_STATUS_MAP = {
    "SCHEDULED": FixtureStatus.SCHEDULED,
    "TIMED": FixtureStatus.SCHEDULED,
    "IN_PLAY": FixtureStatus.LIVE,
    "PAUSED": FixtureStatus.LIVE,
    "FINISHED": FixtureStatus.FINISHED,
    "AWARDED": FixtureStatus.FINISHED,
    "POSTPONED": FixtureStatus.POSTPONED,
    "SUSPENDED": FixtureStatus.CANCELLED,
    "CANCELLED": FixtureStatus.CANCELLED,
}


def map_status(raw: str) -> FixtureStatus:
    return _STATUS_MAP.get(raw, FixtureStatus.SCHEDULED)


_EMPTY_TTL = 1800  # a competition with no matches that day — re-check in 30 min
_ERROR_TTL = 60  # rate-limited/failed — brief negative cache so we stop hammering


def _ttl_for_fixtures(fixtures: list[Fixture]) -> int:
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
        client: FootballDataClient,
    ) -> None:
        self._db = db
        self._cache = cache
        self._client = client

    async def list_for_competition_and_date(
        self, *, competition_id: int, match_date: date_type
    ) -> list[FixtureResponse]:
        cache_key = f"acca:fixtures:{competition_id}:{match_date.isoformat()}"

        cached = await self._cache.get(cache_key)
        if cached is not None:
            return [FixtureResponse.model_validate(item) for item in cached]

        try:
            rows = await self._client.fixtures_by_competition_and_date(
                competition_id=competition_id, match_date=match_date
            )
        except FootballDataError:
            logger.warning("football-data.org request failed", exc_info=True)
            await self._cache.set(cache_key, [], ttl_seconds=_ERROR_TTL)
            return []

        if not rows:
            await self._cache.set(cache_key, [], ttl_seconds=_EMPTY_TTL)
            return []

        fixtures = await self._sync_to_db(rows)
        responses = [FixtureResponse.model_validate(f) for f in fixtures]

        serialised = [r.model_dump(mode="json") for r in responses]
        await self._cache.set(cache_key, serialised, ttl_seconds=_ttl_for_fixtures(fixtures))
        return responses

    async def _sync_to_db(self, rows: list[ParsedFixture]) -> list[Fixture]:
        league_repo = LeagueRepository(self._db)
        team_repo = TeamRepository(self._db)
        fixture_repo = FixtureRepository(self._db)

        first = rows[0]
        league = await league_repo.upsert(
            external_id=first.league_external_id,
            name=first.league_name,
            country=first.league_country,
            logo_url=first.league_logo_url,
        )

        team_inputs: dict[int, tuple[int, str, str | None]] = {}
        for row in rows:
            team_inputs[row.home.external_id] = (
                row.home.external_id,
                row.home.name,
                row.home.logo_url,
            )
            team_inputs[row.away.external_id] = (
                row.away.external_id,
                row.away.name,
                row.away.logo_url,
            )
        teams_by_external_id = await team_repo.upsert_many(team_inputs.values())

        fixtures: list[Fixture] = []
        for row in rows:
            kickoff = datetime.fromisoformat(row.kickoff_at.replace("Z", "+00:00"))
            fixture = await fixture_repo.upsert(
                external_id=row.external_id,
                league_id=league.id,
                home_team_id=teams_by_external_id[row.home.external_id].id,
                away_team_id=teams_by_external_id[row.away.external_id].id,
                kickoff_at=kickoff,
                status=map_status(row.status),
                home_goals=row.home_goals,
                away_goals=row.away_goals,
            )
            fixtures.append(fixture)

        await self._db.commit()
        for fixture in fixtures:
            await self._db.refresh(fixture)
        return fixtures
