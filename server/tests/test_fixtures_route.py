from collections.abc import AsyncIterator
from datetime import datetime

import httpx
import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from httpx import AsyncClient
from redis.asyncio import Redis

from app.db.redis import get_redis
from app.main import app
from app.routers.fixtures import get_football_client
from app.services.football_api import APIFootballClient

VALID_EMAIL = "martin@example.com"
VALID_PASSWORD = "correct-horse-battery-staple"


def _fixture_payload() -> dict:
    return {
        "errors": [],
        "response": [
            {
                "fixture": {
                    "id": 1001,
                    "date": "2026-05-28T15:00:00+00:00",
                    "status": {"short": "NS"},
                },
                "league": {
                    "id": 39,
                    "name": "Premier League",
                    "country": "England",
                    "logo": "https://example.com/pl.png",
                },
                "teams": {
                    "home": {"id": 33, "name": "Manchester United", "logo": None},
                    "away": {"id": 34, "name": "Newcastle", "logo": None},
                },
                "goals": {"home": None, "away": None},
            },
            {
                "fixture": {
                    "id": 1002,
                    "date": "2026-05-28T17:30:00+00:00",
                    "status": {"short": "FT"},
                },
                "league": {
                    "id": 39,
                    "name": "Premier League",
                    "country": "England",
                    "logo": "https://example.com/pl.png",
                },
                "teams": {
                    "home": {"id": 40, "name": "Liverpool", "logo": None},
                    "away": {"id": 49, "name": "Chelsea", "logo": None},
                },
                "goals": {"home": 2, "away": 1},
            },
        ],
    }


@pytest_asyncio.fixture
async def fake_redis() -> AsyncIterator[Redis]:
    redis = FakeRedis(decode_responses=True)
    yield redis
    await redis.aclose()


@pytest_asyncio.fixture
async def authenticated_client(
    client: AsyncClient, fake_redis: Redis
) -> AsyncIterator[AsyncClient]:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_fixture_payload())

    fake_football = APIFootballClient(
        base_url="https://v3.football.api-sports.io",
        api_key="test-key",
        http_client=httpx.AsyncClient(transport=httpx.MockTransport(handler)),
    )

    async def override_redis() -> Redis:
        return fake_redis

    async def override_football() -> AsyncIterator[APIFootballClient]:
        yield fake_football

    app.dependency_overrides[get_redis] = override_redis
    app.dependency_overrides[get_football_client] = override_football

    await client.post("/auth/register", json={"email": VALID_EMAIL, "password": VALID_PASSWORD})
    login = await client.post(
        "/auth/login", json={"email": VALID_EMAIL, "password": VALID_PASSWORD}
    )
    token = login.json()["access_token"]
    client.headers["Authorization"] = f"Bearer {token}"

    yield client

    await fake_football.aclose()


@pytest.mark.asyncio
async def test_lists_fixtures_for_league_and_date(authenticated_client: AsyncClient) -> None:
    response = await authenticated_client.get(
        "/fixtures", params={"league_id": 39, "date": "2026-05-28", "season": 2025}
    )
    assert response.status_code == 200, response.text
    body = response.json()
    assert len(body) == 2
    assert body[0]["league"]["name"] == "Premier League"
    assert body[0]["home_team"]["name"] == "Manchester United"
    assert body[0]["status"] == "scheduled"
    assert body[1]["status"] == "finished"
    assert body[1]["home_goals"] == 2


@pytest.mark.asyncio
async def test_requires_authentication(client: AsyncClient) -> None:
    response = await client.get("/fixtures", params={"league_id": 39, "date": "2026-05-28"})
    assert response.status_code == 401


@pytest.mark.asyncio
async def test_second_call_is_cached(authenticated_client: AsyncClient) -> None:
    r1 = await authenticated_client.get(
        "/fixtures", params={"league_id": 39, "date": "2026-05-28", "season": 2025}
    )
    r2 = await authenticated_client.get(
        "/fixtures", params={"league_id": 39, "date": "2026-05-28", "season": 2025}
    )
    assert r1.status_code == 200
    assert r2.status_code == 200
    assert r1.json() == r2.json()


@pytest.mark.asyncio
async def test_uses_today_when_date_omitted(authenticated_client: AsyncClient) -> None:
    today = datetime.now().date().isoformat()
    response = await authenticated_client.get("/fixtures", params={"league_id": 39, "season": 2025})
    assert response.status_code == 200
    cache_key_for_today = f"acca:fixtures:39:{today}"
    assert cache_key_for_today
