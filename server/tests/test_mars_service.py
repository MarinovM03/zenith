from collections.abc import Callable
from datetime import date
from typing import Any

import httpx
import pytest
from fakeredis.aioredis import FakeRedis
from fastapi import HTTPException

from app.services.cache import JsonCache
from app.services.mars import NEGATIVE_SENTINEL, MarsPhotoService


def _raw(image_id: str = "img1") -> dict[str, Any]:
    return {
        "imageid": image_id,
        "sol": 1882,
        "date_taken_utc": "2026-06-06T12:00:00.000",
        "camera": {"instrument": "NAVCAM_LEFT"},
        "image_files": {
            "small": "https://mars.test/s.jpg",
            "medium": "https://mars.test/m.jpg",
            "large": "https://mars.test/l.jpg",
            "full_res": "https://mars.test/f.png",
        },
        "sample_type": "Full",
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
    return MarsPhotoService(http=http, cache=cache, base_url="https://mars.test")


@pytest.mark.asyncio
async def test_fetches_and_flattens(cache: JsonCache) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"images": [_raw("a"), _raw("b")]})

    async with _client(handler) as http:
        result = await _service(http, cache).get_photos(1)

    assert [p.id for p in result] == ["a", "b"]
    assert result[0].camera == "NAVCAM_LEFT"
    assert result[0].img_src == "https://mars.test/s.jpg"
    assert result[0].full_src == "https://mars.test/l.jpg"
    assert result[0].rover == "Perseverance"
    assert result[0].earth_date == date(2026, 6, 6)
    assert await cache.get("mars:mars2020:1") is not None


@pytest.mark.asyncio
async def test_skips_items_without_images(cache: JsonCache) -> None:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"images": [_raw("a"), {"imageid": "b", "sol": 1}]})

    async with _client(handler) as http:
        result = await _service(http, cache).get_photos(1)

    assert [p.id for p in result] == ["a"]


@pytest.mark.asyncio
async def test_second_call_served_from_cache(cache: JsonCache) -> None:
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json={"images": [_raw()]})

    async with _client(handler) as http:
        service = _service(http, cache)
        await service.get_photos(1)
        await service.get_photos(1)

    assert calls == 1


@pytest.mark.asyncio
async def test_caches_negative_on_error(cache: JsonCache) -> None:
    async with _client(lambda _: httpx.Response(500)) as http:
        with pytest.raises(HTTPException) as exc_info:
            await _service(http, cache).get_photos(1)
    assert exc_info.value.status_code == 502
    assert await cache.get("mars:mars2020:1") == NEGATIVE_SENTINEL


@pytest.mark.asyncio
async def test_timeout_does_not_cache_negative(cache: JsonCache) -> None:
    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    async with _client(handler) as http:
        with pytest.raises(HTTPException) as exc_info:
            await _service(http, cache).get_photos(1)

    assert exc_info.value.status_code == 502
    # A timeout must not poison the cache, or the user's retry would fail fast.
    assert await cache.get("mars:mars2020:1") is None
