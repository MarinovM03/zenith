from collections.abc import Callable
from typing import Any

import httpx
import pytest
from fakeredis.aioredis import FakeRedis
from fastapi import HTTPException

from app.services.cache import JsonCache
from app.services.iss import CACHE_KEY, IssService


def _raw(**overrides: Any) -> dict[str, Any]:
    base: dict[str, Any] = {
        "latitude": 20.5,
        "longitude": -75.7,
        "altitude": 413.3,
        "velocity": 27607.5,
        "visibility": "daylight",
        "timestamp": 1780954224,
    }
    base.update(overrides)
    return base


def _client(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.fixture(autouse=True)
def _no_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.iss.UPSTREAM_BACKOFF_SECONDS", 0)


@pytest.fixture
def cache() -> JsonCache:
    return JsonCache(FakeRedis(decode_responses=True))


def _service(http: httpx.AsyncClient, cache: JsonCache) -> IssService:
    return IssService(http=http, cache=cache, base_url="https://iss.test/v1")


@pytest.mark.asyncio
async def test_fetches_and_flattens(cache: JsonCache) -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200, json=_raw())

    async with _client(handler) as http:
        result = await _service(http, cache).get_position()

    assert result.latitude == 20.5
    assert result.altitude_km == 413.3
    assert result.velocity_kph == 27607.5
    assert result.visibility == "daylight"
    assert seen["url"].endswith("/satellites/25544")
    assert await cache.get(CACHE_KEY) is not None


@pytest.mark.asyncio
async def test_second_call_served_from_cache(cache: JsonCache) -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json=_raw())

    async with _client(handler) as http:
        service = _service(http, cache)
        await service.get_position()
        await service.get_position()

    assert calls == 1


@pytest.mark.asyncio
async def test_error_maps_to_502_without_caching(cache: JsonCache) -> None:
    async with _client(lambda _: httpx.Response(500)) as http:
        with pytest.raises(HTTPException) as exc_info:
            await _service(http, cache).get_position()

    assert exc_info.value.status_code == 502
    assert await cache.get(CACHE_KEY) is None
