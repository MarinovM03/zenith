from datetime import date as date_type
from typing import Any

import httpx
from pydantic import BaseModel, Field

from app.core.config import get_settings


class FootballDataError(Exception):
    pass


class _Area(BaseModel):
    name: str | None = None


class _Competition(BaseModel):
    id: int
    name: str
    emblem: str | None = None


class _Team(BaseModel):
    id: int | None = None
    name: str | None = None
    crest: str | None = None


class _ScoreLine(BaseModel):
    home: int | None = None
    away: int | None = None


class _Score(BaseModel):
    full_time: _ScoreLine = Field(default_factory=_ScoreLine, alias="fullTime")


class _Match(BaseModel):
    id: int
    utc_date: str = Field(alias="utcDate")
    status: str
    area: _Area | None = None
    home_team: _Team = Field(alias="homeTeam")
    away_team: _Team = Field(alias="awayTeam")
    score: _Score = Field(default_factory=_Score)


class _MatchesResponse(BaseModel):
    competition: _Competition
    matches: list[_Match] = Field(default_factory=list)


class ParsedTeam(BaseModel):
    external_id: int
    name: str
    logo_url: str | None


class ParsedFixture(BaseModel):
    external_id: int
    league_external_id: int
    league_name: str
    league_country: str
    league_logo_url: str | None
    home: ParsedTeam
    away: ParsedTeam
    kickoff_at: str
    status: str
    home_goals: int | None
    away_goals: int | None


class StandingRow(BaseModel):
    position: int
    team: ParsedTeam
    played: int
    won: int
    draw: int
    lost: int
    goals_for: int
    goals_against: int
    goal_difference: int
    points: int


class StandingsGroup(BaseModel):
    label: str | None
    table: list[StandingRow]


class ScorerRow(BaseModel):
    player_id: int
    player_name: str
    nationality: str | None
    team_name: str | None
    team_crest: str | None
    goals: int | None
    assists: int | None
    played_matches: int | None


class SquadPlayer(BaseModel):
    id: int
    name: str
    position: str | None
    date_of_birth: str | None
    nationality: str | None


class TeamDetail(BaseModel):
    id: int
    name: str
    crest: str | None
    country: str | None
    founded: int | None
    club_colors: str | None
    venue: str | None
    website: str | None
    coach_name: str | None
    squad: list[SquadPlayer]


class MatchDetail(BaseModel):
    external_id: int
    competition_id: int
    competition_name: str
    competition_emblem: str | None
    utc_date: str
    status: str
    matchday: int | None
    venue: str | None
    referee: str | None
    home: ParsedTeam
    away: ParsedTeam
    home_goals: int | None
    away_goals: int | None
    home_half_time: int | None
    away_half_time: int | None


class PlayerDetail(BaseModel):
    id: int
    name: str
    first_name: str | None
    last_name: str | None
    date_of_birth: str | None
    nationality: str | None
    position: str | None
    shirt_number: int | None
    team_id: int | None
    team_name: str | None
    team_crest: str | None


_MATCH_STATUS = {
    "SCHEDULED": "scheduled",
    "TIMED": "scheduled",
    "IN_PLAY": "live",
    "PAUSED": "live",
    "FINISHED": "finished",
    "AWARDED": "finished",
    "POSTPONED": "postponed",
    "SUSPENDED": "cancelled",
    "CANCELLED": "cancelled",
}


def _map_match_status(raw: str) -> str:
    return _MATCH_STATUS.get(raw, "scheduled")


class FootballDataClient:
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

    async def __aenter__(self) -> "FootballDataClient":
        return self

    async def __aexit__(self, *_: Any) -> None:
        await self.aclose()

    async def aclose(self) -> None:
        if self._owns_client:
            await self._client.aclose()

    async def fixtures_by_competition_and_date(
        self, *, competition_id: int, match_date: date_type
    ) -> list[ParsedFixture]:
        if not self._api_key:
            return []
        iso_date = match_date.isoformat()
        data = await self._get_json(
            f"/competitions/{competition_id}/matches",
            params={"dateFrom": iso_date, "dateTo": iso_date},
        )
        body = _MatchesResponse.model_validate(data)
        return [self._normalise(body.competition, match) for match in body.matches]

    async def standings(self, *, competition_id: int) -> list[StandingsGroup]:
        if not self._api_key:
            return []
        data = await self._get_json(f"/competitions/{competition_id}/standings")
        groups: list[StandingsGroup] = []
        for entry in data.get("standings", []):
            if entry.get("type") != "TOTAL":
                continue
            rows = [self._standing_row(row) for row in entry.get("table", [])]
            groups.append(StandingsGroup(label=entry.get("group"), table=rows))
        return groups

    async def scorers(self, *, competition_id: int) -> list[ScorerRow]:
        if not self._api_key:
            return []
        data = await self._get_json(f"/competitions/{competition_id}/scorers")
        return [self._scorer_row(item) for item in data.get("scorers", [])]

    async def team(self, *, team_id: int) -> TeamDetail | None:
        if not self._api_key:
            return None
        data = await self._get_json(f"/teams/{team_id}")
        coach = data.get("coach") or {}
        area = data.get("area") or {}
        squad = [
            SquadPlayer(
                id=player.get("id", 0),
                name=player.get("name", "Unknown"),
                position=player.get("position"),
                date_of_birth=player.get("dateOfBirth"),
                nationality=player.get("nationality"),
            )
            for player in data.get("squad", [])
        ]
        return TeamDetail(
            id=data.get("id", team_id),
            name=data.get("name", "Unknown"),
            crest=data.get("crest"),
            country=area.get("name"),
            founded=data.get("founded"),
            club_colors=data.get("clubColors"),
            venue=data.get("venue"),
            website=data.get("website"),
            coach_name=coach.get("name"),
            squad=squad,
        )

    async def match(self, *, match_id: int) -> MatchDetail | None:
        if not self._api_key:
            return None
        data = await self._get_json(f"/matches/{match_id}")
        competition = data.get("competition") or {}
        home = data.get("homeTeam") or {}
        away = data.get("awayTeam") or {}
        score = data.get("score") or {}
        full_time = score.get("fullTime") or {}
        half_time = score.get("halfTime") or {}
        referees = data.get("referees") or []
        referee = referees[0].get("name") if referees else None
        return MatchDetail(
            external_id=data.get("id", match_id),
            competition_id=competition.get("id", 0),
            competition_name=competition.get("name", ""),
            competition_emblem=competition.get("emblem"),
            utc_date=data.get("utcDate", ""),
            status=_map_match_status(data.get("status", "")),
            matchday=data.get("matchday"),
            venue=data.get("venue"),
            referee=referee,
            home=ParsedTeam(
                external_id=home.get("id", 0),
                name=home.get("name", "Unknown"),
                logo_url=home.get("crest"),
            ),
            away=ParsedTeam(
                external_id=away.get("id", 0),
                name=away.get("name", "Unknown"),
                logo_url=away.get("crest"),
            ),
            home_goals=full_time.get("home"),
            away_goals=full_time.get("away"),
            home_half_time=half_time.get("home"),
            away_half_time=half_time.get("away"),
        )

    async def person(self, *, person_id: int) -> PlayerDetail | None:
        if not self._api_key:
            return None
        data = await self._get_json(f"/persons/{person_id}")
        team = data.get("currentTeam") or {}
        return PlayerDetail(
            id=data.get("id", person_id),
            name=data.get("name", "Unknown"),
            first_name=data.get("firstName"),
            last_name=data.get("lastName"),
            date_of_birth=data.get("dateOfBirth"),
            nationality=data.get("nationality"),
            position=data.get("position"),
            shirt_number=data.get("shirtNumber"),
            team_id=team.get("id"),
            team_name=team.get("name"),
            team_crest=team.get("crest"),
        )

    async def _get_json(self, path: str, params: dict | None = None) -> dict:
        response = await self._client.get(
            f"{self._base_url}{path}",
            params=params,
            headers={"X-Auth-Token": self._api_key},
        )
        if response.status_code != 200:
            message = self._extract_message(response)
            raise FootballDataError(f"football-data.org HTTP {response.status_code}: {message}")
        return response.json()

    @staticmethod
    def _standing_row(row: dict) -> StandingRow:
        team = row.get("team", {})
        return StandingRow(
            position=row.get("position", 0),
            team=ParsedTeam(
                external_id=team.get("id", 0),
                name=team.get("name", "Unknown"),
                logo_url=team.get("crest"),
            ),
            played=row.get("playedGames", 0),
            won=row.get("won", 0),
            draw=row.get("draw", 0),
            lost=row.get("lost", 0),
            goals_for=row.get("goalsFor", 0),
            goals_against=row.get("goalsAgainst", 0),
            goal_difference=row.get("goalDifference", 0),
            points=row.get("points", 0),
        )

    @staticmethod
    def _scorer_row(item: dict) -> ScorerRow:
        player = item.get("player", {})
        team = item.get("team", {})
        return ScorerRow(
            player_id=player.get("id", 0),
            player_name=player.get("name", "Unknown"),
            nationality=player.get("nationality"),
            team_name=team.get("name"),
            team_crest=team.get("crest"),
            goals=item.get("goals"),
            assists=item.get("assists"),
            played_matches=item.get("playedMatches"),
        )

    @staticmethod
    def _extract_message(response: httpx.Response) -> str:
        try:
            return str(response.json().get("message", response.text))
        except Exception:
            return response.text

    @staticmethod
    def _normalise(competition: _Competition, match: _Match) -> ParsedFixture:
        return ParsedFixture(
            external_id=match.id,
            league_external_id=competition.id,
            league_name=competition.name,
            league_country=(match.area.name if match.area else "") or "",
            league_logo_url=competition.emblem,
            home=ParsedTeam(
                external_id=match.home_team.id or 0,
                name=match.home_team.name or "Unknown",
                logo_url=match.home_team.crest,
            ),
            away=ParsedTeam(
                external_id=match.away_team.id or 0,
                name=match.away_team.name or "Unknown",
                logo_url=match.away_team.crest,
            ),
            kickoff_at=match.utc_date,
            status=match.status,
            home_goals=match.score.full_time.home,
            away_goals=match.score.full_time.away,
        )


_shared_http_client: httpx.AsyncClient | None = None


def get_shared_http_client() -> httpx.AsyncClient:
    """A single app-wide HTTP client so connections are pooled and kept alive
    instead of doing a fresh TLS handshake on every request."""
    global _shared_http_client
    if _shared_http_client is None:
        _shared_http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0),
            limits=httpx.Limits(max_connections=20, max_keepalive_connections=10),
        )
    return _shared_http_client


async def close_shared_http_client() -> None:
    global _shared_http_client
    if _shared_http_client is not None:
        await _shared_http_client.aclose()
        _shared_http_client = None


def build_client() -> FootballDataClient:
    settings = get_settings()
    return FootballDataClient(
        base_url=settings.football_data_base_url,
        api_key=settings.football_data_api_key,
        http_client=get_shared_http_client(),
    )
