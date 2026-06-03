import logging

from app.services.cache import JsonCache
from app.services.football_data import (
    FootballDataClient,
    FootballDataError,
    MatchDetail,
    PlayerDetail,
    ScorerRow,
    StandingsGroup,
    TeamDetail,
)

logger = logging.getLogger(__name__)

_STANDINGS_TTL = 3600
_SCORERS_TTL = 3600
_TEAM_TTL = 24 * 3600
_PLAYER_TTL = 24 * 3600


class CompetitionsService:
    def __init__(self, *, cache: JsonCache, client: FootballDataClient) -> None:
        self._cache = cache
        self._client = client

    async def standings(self, competition_id: int) -> list[StandingsGroup]:
        key = f"acca:standings:{competition_id}"
        cached = await self._cache.get(key)
        if cached is not None:
            return [StandingsGroup.model_validate(group) for group in cached]
        try:
            groups = await self._client.standings(competition_id=competition_id)
        except FootballDataError:
            logger.warning("standings request failed", exc_info=True)
            return []
        await self._cache.set(
            key, [group.model_dump(mode="json") for group in groups], ttl_seconds=_STANDINGS_TTL
        )
        return groups

    async def scorers(self, competition_id: int) -> list[ScorerRow]:
        key = f"acca:scorers:{competition_id}"
        cached = await self._cache.get(key)
        if cached is not None:
            return [ScorerRow.model_validate(row) for row in cached]
        try:
            rows = await self._client.scorers(competition_id=competition_id)
        except FootballDataError:
            logger.warning("scorers request failed", exc_info=True)
            return []
        await self._cache.set(
            key, [row.model_dump(mode="json") for row in rows], ttl_seconds=_SCORERS_TTL
        )
        return rows

    async def team(self, team_id: int) -> TeamDetail | None:
        key = f"acca:team:{team_id}"
        cached = await self._cache.get(key)
        if cached is not None:
            return TeamDetail.model_validate(cached)
        try:
            team = await self._client.team(team_id=team_id)
        except FootballDataError:
            logger.warning("team request failed", exc_info=True)
            return None
        if team is None:
            return None
        await self._cache.set(key, team.model_dump(mode="json"), ttl_seconds=_TEAM_TTL)
        return team

    async def match(self, match_id: int) -> MatchDetail | None:
        key = f"acca:match:{match_id}"
        cached = await self._cache.get(key)
        if cached is not None:
            return MatchDetail.model_validate(cached)
        try:
            detail = await self._client.match(match_id=match_id)
        except FootballDataError:
            logger.warning("match request failed", exc_info=True)
            return None
        if detail is None:
            return None
        if detail.status == "live":
            ttl = 30
        elif detail.status == "finished":
            ttl = 24 * 3600
        else:
            ttl = 300
        await self._cache.set(key, detail.model_dump(mode="json"), ttl_seconds=ttl)
        return detail

    async def player(self, person_id: int) -> PlayerDetail | None:
        key = f"acca:player:{person_id}"
        cached = await self._cache.get(key)
        if cached is not None:
            return PlayerDetail.model_validate(cached)
        try:
            detail = await self._client.person(person_id=person_id)
        except FootballDataError:
            logger.warning("player request failed", exc_info=True)
            return None
        if detail is None:
            return None
        await self._cache.set(key, detail.model_dump(mode="json"), ttl_seconds=_PLAYER_TTL)
        return detail
