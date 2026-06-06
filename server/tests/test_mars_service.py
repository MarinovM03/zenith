from collections.abc import Callable
from datetime import date
from typing import Any

import httpx
import pytest
from fakeredis.aioredis import FakeRedis
from fastapi import HTTPException

from app.services.cache import JsonCache
from app.services.mars import NEGATIVE_SENTINEL, MarsPhotoService


def _raw(photo_id: int = 1, img: str = "http://mars.test/img.jpg") -> dict[str, Any]:
    return {
        "id": photo_id,
        "sol": 1000,
        "earth_date": "2024-01-01",
        "camera": {"name": "FHAZ", "full_name": "Front Hazard Avoidance Camera"},
        "img_src": img,
        "rover": {"name": "Curiosity"},
    }


def _client(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.fixture(autouse=True)
def _no_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.setattr("app.services.mars.UPSTREAM_BACKOFF_SECONDS", 0)


@pytest.fixture
def cache() -> JsonCache:
    return JsonCache(FakeRedis(decode_responses=True))


def _service(http: httpx.AsyncClient, cache: JsonCache) -> MarsPhotoService:
    return MarsPhotoService(http=http, cache=cache, api_key="key", base_url="https://api.test")


@pytest.mark.asyncio
async def test_fetches_flattens_and_forces_https(cache: JsonCache) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"photos": [_raw(1), _raw(2)]})

    async with _client(handler) as http:
        result = await _service(http, cache).get_photos("curiosity", date(2024, 1, 1), 1)

    assert [p.id for p in result] == [1, 2]
    assert result[0].camera == "Front Hazard Avoidance Camera"
    assert result[0].img_src.startswith("https://")
    assert await cache.get("mars:curiosity:2024-01-01:1") is not None


@pytest.mark.asyncio
async def test_second_call_served_from_cache(cache: JsonCache) -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"photos": [_raw()]})

    async with _client(handler) as http:
        service = _service(http, cache)
        await service.get_photos("curiosity", date(2024, 1, 1), 1)
        await service.get_photos("curiosity", date(2024, 1, 1), 1)

    assert calls == 1


@pytest.mark.asyncio
async def test_unknown_rover_rejected(cache: JsonCache) -> None:
    async with _client(lambda _: httpx.Response(200, json={"photos": []})) as http:
        with pytest.raises(HTTPException) as exc_info:
            await _service(http, cache).get_photos("rover-x", date(2024, 1, 1), 1)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_caches_negative_on_error(cache: JsonCache) -> None:
    async with _client(lambda _: httpx.Response(500)) as http:
        with pytest.raises(HTTPException) as exc_info:
            await _service(http, cache).get_photos("curiosity", date(2024, 1, 1), 1)
    assert exc_info.value.status_code == 502
    assert await cache.get("mars:curiosity:2024-01-01:1") == NEGATIVE_SENTINEL
