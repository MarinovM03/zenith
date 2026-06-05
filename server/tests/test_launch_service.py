from collections.abc import Callable
from typing import Any

import httpx
import pytest
from fakeredis.aioredis import FakeRedis
from fastapi import HTTPException

from app.services.cache import JsonCache
from app.services.launch import NEGATIVE_SENTINEL, LaunchService


def _raw(launch_id: str = "abc", name: str = "Falcon 9 | Starlink") -> dict[str, Any]:
    return {
        "id": launch_id,
        "name": name,
        "status": {"name": "Go for Launch", "abbrev": "Go"},
        "net": "2026-07-01T12:00:00Z",
        "launch_service_provider": {"name": "SpaceX"},
        "rocket": {"configuration": {"name": "Falcon 9"}},
        "mission": {"name": "Starlink", "description": "Sats."},
        "pad": {"name": "SLC-40", "location": {"name": "Cape Canaveral"}},
        "image": "https://example.test/rocket.jpg",
        "vidURLs": [{"url": "https://youtube.test/live"}],
    }


def _client(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.fixture(autouse=True)
def _no_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.launch.UPSTREAM_BACKOFF_SECONDS", 0)


@pytest.fixture
def cache() -> JsonCache:
    return JsonCache(FakeRedis(decode_responses=True))


def _service(http: httpx.AsyncClient, cache: JsonCache) -> LaunchService:
    return LaunchService(http=http, cache=cache, base_url="https://ll.test/2.2.0")


@pytest.mark.asyncio
async def test_upcoming_fetches_and_flattens(cache: JsonCache) -> None:
    seen: dict[str, str] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen["url"] = str(request.url)
        return httpx.Response(200, json={"results": [_raw("a"), _raw("b")]})

    async with _client(handler) as http:
        result = await _service(http, cache).get_upcoming(5)

    assert [item.id for item in result] == ["a", "b"]
    assert result[0].provider == "SpaceX"
    assert result[0].rocket == "Falcon 9"
    assert result[0].location == "Cape Canaveral"
    assert result[0].webcast_url == "https://youtube.test/live"
    assert "launch/upcoming" in seen["url"]
    assert await cache.get("launches:upcoming:5") is not None


@pytest.mark.asyncio
async def test_upcoming_second_call_served_from_cache(cache: JsonCache) -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"results": [_raw("a")]})

    async with _client(handler) as http:
        service = _service(http, cache)
        await service.get_upcoming(5)
        await service.get_upcoming(5)

    assert calls == 1


@pytest.mark.asyncio
async def test_upcoming_caches_negative_on_error(cache: JsonCache) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    async with _client(handler) as http:
        with pytest.raises(HTTPException) as exc_info:
            await _service(http, cache).get_upcoming(5)

    assert exc_info.value.status_code == 502
    assert await cache.get("launches:upcoming:5") == NEGATIVE_SENTINEL


@pytest.mark.asyncio
async def test_detail_retries_transient_then_succeeds(cache: JsonCache) -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(503)
        return httpx.Response(200, json=_raw("xyz"))

    async with _client(handler) as http:
        result = await _service(http, cache).get_detail("xyz")

    assert result.id == "xyz"
    assert calls == 2


@pytest.mark.asyncio
async def test_detail_404_maps_to_not_found(cache: JsonCache) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(404)

    async with _client(handler) as http:
        with pytest.raises(HTTPException) as exc_info:
            await _service(http, cache).get_detail("nope")

    assert exc_info.value.status_code == 404
    assert await cache.get("launches:detail:nope") is None
