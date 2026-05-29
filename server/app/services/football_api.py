from datetime import date as date_type
from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.core.config import get_settings


class APIFootballError(Exception):
    pass


class _StatusResp(BaseModel):
    short: str


class _FixtureInfoResp(BaseModel):
    id: int
    date: str
    status: _StatusResp


class LeagueRow(BaseModel):
    id: int
    name: str
    country: str
    logo: str | None = None


class TeamRow(BaseModel):
    id: int
    name: str
    logo: str | None = None


class _TeamsResp(BaseModel):
    home: TeamRow
    away: TeamRow


class _GoalsResp(BaseModel):
    home: int | None = None
    away: int | None = None


class FixtureRow(BaseModel):
    fixture: _FixtureInfoResp
    league: LeagueRow
    teams: _TeamsResp
    goals: _GoalsResp


class _FixturesResponseBody(BaseModel):
    errors: list[Any] | dict[str, Any] = Field(default_factory=list)
    response: list[FixtureRow] = Field(default_factory=list)


class APIFootballClient:
    def __init__(
        self,
        *,
        base_url: str,
        api_key: str,
        http_client: httpx.AsyncClient | None = None,
    ) -> None:
        self._base_url = base_url.rstrip("/")
        self._api_key = api_key
        self._client = http_client or httpx.AsyncClient(timeout=httpx.Timeout(10.0))
        self._owns_client = http_client is None

    async def __aenter__(self) -> "APIFootballClient":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def fixtures_by_league_and_date(
        self, *, league_id: int, season: int, match_date: date_type
    ) -> list[FixtureRow]:
        if not self._api_key:
            return []

        params = {
            "league": league_id,
            "season": season,
            "date": match_date.isoformat(),
        }
        headers = {"x-apisports-key": self._api_key}

        response = await self._client.get(
            f"{self._base_url}/fixtures", params=params, headers=headers
        )
        if response.status_code != 200:
            raise APIFootballError(f"API-Football returned HTTP {response.status_code}")

        body = _FixturesResponseBody.model_validate(response.json())
        if isinstance(body.errors, dict) and body.errors:
            raise APIFootballError(f"API-Football error: {body.errors}")
        if isinstance(body.errors, list) and body.errors:
            raise APIFootballError(f"API-Football error: {body.errors}")
        return body.response


def build_client() -> APIFootballClient:
    settings = get_settings()
    return APIFootballClient(
        base_url=settings.api_football_base_url,
        api_key=settings.api_football_key,
    )
