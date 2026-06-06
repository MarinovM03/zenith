from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers.asteroid import get_asteroid_service
from app.services.asteroid import AsteroidService
from app.services.cache import JsonCache


def _feed() -> dict[str, Any]:
    return {
        "near_earth_objects": {
            "2026-06-06": [
                {
                    "id": "1",
                    "name": "(2026 AB)",
                    "is_potentially_hazardous_asteroid": True,
                    "estimated_diameter": {
                        "meters": {
                            "estimated_diameter_min": 30.0,
                            "estimated_diameter_max": 60.0,
                        }
                    },
                    "close_approach_data": [
                        {
                            "close_approach_date": "2026-06-06",
                            "close_approach_date_full": "2026-Jun-06 12:00",
                            "relative_velocity": {"kilometers_per_second": "18.5"},
                            "miss_distance": {"kilometers": "250000", "lunar": "0.65"},
                        }
                    ],
                }
            ]
        }
    }


@pytest_asyncio.fixture
async def asteroid_client() -> AsyncIterator[AsyncClient]:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_feed())

    upstream = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    service = AsteroidService(
        http=upstream,
        cache=JsonCache(FakeRedis(decode_responses=True)),
        api_key="key",
        base_url="https://api.test",
    )
    app.dependency_overrides[get_asteroid_service] = lambda: service
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    await upstream.aclose()


@pytest.mark.asyncio
async def test_feed_happy_path(asteroid_client: AsyncClient) -> None:
    response = await asteroid_client.get(
        "/asteroids", params={"start": "2026-06-06", "end": "2026-06-06"}
    )
    assert response.status_code == 200
    body = response.json()
    assert body[0]["name"] == "(2026 AB)"
    assert body[0]["hazardous"] is True
    assert body[0]["miss_distance_km"] == 250000.0


@pytest.mark.asyncio
async def test_feed_defaults_without_dates(asteroid_client: AsyncClient) -> None:
    response = await asteroid_client.get("/asteroids")
    assert response.status_code == 200
    assert len(response.json()) == 1


@pytest.mark.asyncio
async def test_feed_rejects_wide_range(asteroid_client: AsyncClient) -> None:
    response = await asteroid_client.get(
        "/asteroids", params={"start": "2026-06-01", "end": "2026-07-01"}
    )
    assert response.status_code == 400
