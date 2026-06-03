from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from redis.asyncio import Redis

from app.db.redis import get_redis
from app.models.user import User
from app.routers.fixtures import get_football_client
from app.services.auth import get_current_user
from app.services.cache import JsonCache
from app.services.competitions import CompetitionsService
from app.services.football_data import (
    FootballDataClient,
    MatchDetail,
    PlayerDetail,
    ScorerRow,
    StandingsGroup,
    TeamDetail,
)

RedisDep = Annotated[Redis, Depends(get_redis)]
FootballClientDep = Annotated[FootballDataClient, Depends(get_football_client)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]

router = APIRouter(tags=["competitions"])


def _service(redis: Redis, football: FootballDataClient) -> CompetitionsService:
    return CompetitionsService(cache=JsonCache(redis), client=football)


@router.get("/competitions/{competition_id}/standings", response_model=list[StandingsGroup])
async def standings(
    current_user: CurrentUserDep,
    redis: RedisDep,
    football: FootballClientDep,
    competition_id: int,
) -> list[StandingsGroup]:
    return await _service(redis, football).standings(competition_id)


@router.get("/competitions/{competition_id}/scorers", response_model=list[ScorerRow])
async def scorers(
    current_user: CurrentUserDep,
    redis: RedisDep,
    football: FootballClientDep,
    competition_id: int,
) -> list[ScorerRow]:
    return await _service(redis, football).scorers(competition_id)


@router.get("/teams/{team_id}", response_model=TeamDetail)
async def team(
    current_user: CurrentUserDep,
    redis: RedisDep,
    football: FootballClientDep,
    team_id: int,
) -> TeamDetail:
    detail = await _service(redis, football).team(team_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="team not found")
    return detail


@router.get("/matches/{match_id}", response_model=MatchDetail)
async def match(
    current_user: CurrentUserDep,
    redis: RedisDep,
    football: FootballClientDep,
    match_id: int,
) -> MatchDetail:
    detail = await _service(redis, football).match(match_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="match not found")
    return detail


@router.get("/players/{player_id}", response_model=PlayerDetail)
async def player(
    current_user: CurrentUserDep,
    redis: RedisDep,
    football: FootballClientDep,
    player_id: int,
) -> PlayerDetail:
    detail = await _service(redis, football).player(player_id)
    if detail is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="player not found")
    return detail
