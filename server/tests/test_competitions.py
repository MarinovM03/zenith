from collections.abc import AsyncIterator

import httpx
import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from httpx import AsyncClient
from redis.asyncio import Redis

from app.db.redis import get_redis
from app.main import app
from app.routers.fixtures import get_football_client
from app.services.football_data import FootballDataClient

EMAIL = "martin@example.com"
PASSWORD = "correct-horse-battery-staple"

STANDINGS_PAYLOAD = {
    "standings": [
        {
            "stage": "REGULAR_SEASON",
            "type": "TOTAL",
            "group": None,
            "table": [
                {
                    "position": 1,
                    "team": {"id": 57, "name": "Arsenal FC", "crest": "c.png"},
                    "playedGames": 38,
                    "won": 26,
                    "draw": 7,
                    "lost": 5,
                    "points": 85,
                    "goalsFor": 71,
                    "goalsAgainst": 27,
                    "goalDifference": 44,
                }
            ],
        },
        {"type": "HOME", "group": None, "table": []},
    ]
}

SCORERS_PAYLOAD = {
    "scorers": [
        {
            "player": {"id": 38101, "name": "Erling Haaland", "nationality": "Norway"},
            "team": {"id": 65, "name": "Manchester City FC", "crest": "c.png"},
            "playedMatches": 31,
            "goals": 27,
            "assists": 8,
        }
    ]
}

TEAM_PAYLOAD = {
    "id": 57,
    "name": "Arsenal FC",
    "crest": "c.png",
    "area": {"name": "England"},
    "founded": 1886,
    "clubColors": "Red / White",
    "venue": "Emirates Stadium",
    "website": "https://www.arsenal.com",
    "coach": {"id": 1, "name": "Mikel Arteta"},
    "squad": [
        {
            "id": 3189,
            "name": "Kepa Arrizabalaga",
            "position": "Goalkeeper",
            "dateOfBirth": "1994-10-03",
            "nationality": "Spain",
        }
    ],
}

MATCH_PAYLOAD = {
    "id": 537785,
    "utcDate": "2025-08-15T19:00:00Z",
    "status": "FINISHED",
    "matchday": 1,
    "venue": "Anfield",
    "competition": {"id": 2021, "name": "Premier League", "emblem": "pl.png"},
    "homeTeam": {"id": 64, "name": "Liverpool FC", "crest": "liv.png"},
    "awayTeam": {"id": 1044, "name": "AFC Bournemouth", "crest": "bou.png"},
    "score": {"fullTime": {"home": 4, "away": 2}, "halfTime": {"home": 1, "away": 0}},
    "referees": [{"id": 11580, "name": "Anthony Taylor", "type": "REFEREE"}],
}

PLAYER_PAYLOAD = {
    "id": 38101,
    "name": "Erling Haaland",
    "firstName": "Erling",
    "lastName": "Haaland",
    "dateOfBirth": "2000-07-21",
    "nationality": "Norway",
    "position": "Offence",
    "shirtNumber": 9,
    "currentTeam": {"id": 65, "name": "Manchester City FC", "crest": "mc.png"},
}


def _router(payloads: dict[str, dict]):
    def handler(request: httpx.Request) -> httpx.Response:
        for needle, payload in payloads.items():
            if needle in request.url.path:
                return httpx.Response(200, json=payload)
        return httpx.Response(404, json={"message": "not found"})

    return handler


@pytest_asyncio.fixture
async def fake_redis() -> AsyncIterator[Redis]:
    redis = FakeRedis(decode_responses=True)
    yield redis
    await redis.aclose()


def _make_auth_client(handler):
    @pytest_asyncio.fixture
    async def _fixture(client: AsyncClient, fake_redis: Redis) -> AsyncIterator[AsyncClient]:
        fake_football = FootballDataClient(
            base_url="https://api.football-data.org/v4",
            api_key="test-key",
            http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
        )

        async def override_redis() -> Redis:
            return fake_redis

        async def override_football() -> AsyncIterator[FootballDataClient]:
            yield fake_football

        app.dependency_overrides[get_redis] = override_redis
        app.dependency_overrides[get_football_client] = override_football

        await client.post("/auth/register", json={"email": EMAIL, "password": PASSWORD})
        login = await client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
        client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"

        yield client
        await fake_football.aclose()

    return _fixture


auth_client = _make_auth_client(
    _router(
        {
            "/standings": STANDINGS_PAYLOAD,
            "/scorers": SCORERS_PAYLOAD,
            "/teams/57": TEAM_PAYLOAD,
            "/matches/537785": MATCH_PAYLOAD,
            "/persons/38101": PLAYER_PAYLOAD,
        }
    )
)


@pytest.mark.asyncio
async def test_standings_returns_total_table_only(auth_client: AsyncClient) -> None:
    response = await auth_client.get("/competitions/2021/standings")
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 1
    assert body[0]["table"][0]["team"]["name"] == "Arsenal FC"
    assert body[0]["table"][0]["points"] == 85


@pytest.mark.asyncio
async def test_scorers_returns_players(auth_client: AsyncClient) -> None:
    response = await auth_client.get("/competitions/2021/scorers")
    assert response.status_code == 200
    body = response.json()
    assert body[0]["player_name"] == "Erling Haaland"
    assert body[0]["goals"] == 27


@pytest.mark.asyncio
async def test_team_returns_detail_and_squad(auth_client: AsyncClient) -> None:
    response = await auth_client.get("/teams/57")
    assert response.status_code == 200
    body = response.json()
    assert body["name"] == "Arsenal FC"
    assert body["coach_name"] == "Mikel Arteta"
    assert body["venue"] == "Emirates Stadium"
    assert len(body["squad"]) == 1
    assert body["squad"][0]["position"] == "Goalkeeper"


@pytest.mark.asyncio
async def test_match_returns_detail(auth_client: AsyncClient) -> None:
    response = await auth_client.get("/matches/537785")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["home"]["name"] == "Liverpool FC"
    assert body["status"] == "finished"
    assert body["home_goals"] == 4
    assert body["home_half_time"] == 1
    assert body["venue"] == "Anfield"
    assert body["referee"] == "Anthony Taylor"


@pytest.mark.asyncio
async def test_player_returns_detail(auth_client: AsyncClient) -> None:
    response = await auth_client.get("/players/38101")
    assert response.status_code == 200, response.text
    body = response.json()
    assert body["name"] == "Erling Haaland"
    assert body["shirt_number"] == 9
    assert body["nationality"] == "Norway"
    assert body["team_name"] == "Manchester City FC"


@pytest.mark.asyncio
async def test_standings_requires_auth(client: AsyncClient) -> None:
    response = await client.get("/competitions/2021/standings")
    assert response.status_code == 401
