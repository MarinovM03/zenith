from collections.abc import Callable
from datetime import date
from typing import Any

import httpx
import pytest
from fakeredis.aioredis import FakeRedis
from fastapi import HTTPException

from app.services.asteroid import NEGATIVE_SENTINEL, AsteroidService
from app.services.cache import JsonCache


def _neo(
    neo_id: str,
    name: str,
    *,
    hazardous: bool,
    miss_km: float,
    lunar: float,
    vkps: float,
    day: str = "2026-06-06",
) -> dict[str, Any]:
    return {
        "id": neo_id,
        "name": name,
        "is_potentially_hazardous_asteroid": hazardous,
        "estimated_diameter": {
            "meters": {"estimated_diameter_min": 10.0, "estimated_diameter_max": 20.0}
        },
        "close_approach_data": [
            {
                "close_approach_date": day,
                "close_approach_date_full": f"{day} 12:00",
                "relative_velocity": {"kilometers_per_second": str(vkps)},
                "miss_distance": {"kilometers": str(miss_km), "lunar": str(lunar)},
            }
        ],
    }


def _feed() -> dict[str, Any]:
    return {
        "near_earth_objects": {
            "2026-06-06": [
                _neo("1", "Far One", hazardous=False, miss_km=500000.0, lunar=1.3, vkps=12.0),
                _neo("2", "Close One", hazardous=True, miss_km=100000.0, lunar=0.3, vkps=20.0),
            ]
        }
    }


def _client(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.fixture(autouse=True)
def _no_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.asteroid.UPSTREAM_BACKOFF_SECONDS", 0)


@pytest.fixture
def cache() -> JsonCache:
    return JsonCache(FakeRedis(decode_responses=True))


def _service(http: httpx.AsyncClient, cache: JsonCache) -> AsteroidService:
    return AsteroidService(http=http, cache=cache, api_key="key", base_url="https://api.test")


@pytest.mark.asyncio
async def test_flattens_and_sorts_by_miss_distance(cache: JsonCache) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_feed())

    async with _client(handler) as http:
        result = await _service(http, cache).get_feed(date(2026, 6, 6), date(2026, 6, 6))

    assert [a.id for a in result] == ["2", "1"]
    assert result[0].hazardous is True
    assert result[0].miss_distance_km == 100000.0
    assert result[0].velocity_kps == 20.0
    assert result[0].diameter_max_m == 20.0
    assert await cache.get("asteroids:2026-06-06:2026-06-06") is not None


@pytest.mark.asyncio
async def test_second_call_served_from_cache(cache: JsonCache) -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json=_feed())

    async with _client(handler) as http:
        service = _service(http, cache)
        await service.get_feed(date(2026, 6, 6), date(2026, 6, 6))
        await service.get_feed(date(2026, 6, 6), date(2026, 6, 6))

    assert calls == 1


@pytest.mark.asyncio
async def test_caches_negative_on_error(cache: JsonCache) -> None:
    async with _client(lambda _: httpx.Response(500)) as http:
        with pytest.raises(HTTPException) as exc_info:
            await _service(http, cache).get_feed(date(2026, 6, 6), date(2026, 6, 6))
    assert exc_info.value.status_code == 502
    assert await cache.get("asteroids:2026-06-06:2026-06-06") == NEGATIVE_SENTINEL


@pytest.mark.asyncio
async def test_rejects_range_over_seven_days(cache: JsonCache) -> None:
    async with _client(lambda _: httpx.Response(200, json=_feed())) as http:
        with pytest.raises(HTTPException) as exc_info:
            await _service(http, cache).get_feed(date(2026, 6, 1), date(2026, 6, 30))
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_rejects_inverted_range(cache: JsonCache) -> None:
    async with _client(lambda _: httpx.Response(200, json=_feed())) as http:
        with pytest.raises(HTTPException) as exc_info:
            await _service(http, cache).get_feed(date(2026, 6, 10), date(2026, 6, 1))
    assert exc_info.value.status_code == 400
