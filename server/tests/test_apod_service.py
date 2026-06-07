from collections.abc import Callable
from datetime import date, timedelta
from typing import Any

import httpx
import pytest
from fakeredis.aioredis import FakeRedis
from fastapi import HTTPException

from app.services.apod import (
    APOD_EPOCH,
    CACHE_TTL_SECONDS,
    NEGATIVE_CACHE_TTL_SECONDS,
    NEGATIVE_SENTINEL,
    NasaApodService,
    _cache_key,
    _today_utc,
)
from app.services.cache import JsonCache


def _sample(day: date, *, media_type: str = "image") -> dict[str, Any]:
    return {
        "date": day.isoformat(),
        "title": f"Title {day}",
        "explanation": "An explanation.",
        "url": "https://example.test/img.jpg",
        "hdurl": "https://example.test/img-hd.jpg",
        "media_type": media_type,
        "copyright": "Some Photographer",
    }


def _client(handler: Callable[[httpx.Request], httpx.Response]) -> httpx.AsyncClient:
    return httpx.AsyncClient(transport=httpx.MockTransport(handler))


@pytest.fixture(autouse=True)
def _no_backoff(monkeypatch: pytest.MonkeyPatch) -> None:
    """Keep retry tests instant by removing the backoff sleep."""
    monkeypatch.setattr("app.services.apod.UPSTREAM_BACKOFF_SECONDS", 0)


@pytest.fixture
def cache() -> JsonCache:
    return JsonCache(FakeRedis(decode_responses=True))


def _service(http: httpx.AsyncClient, cache: JsonCache) -> NasaApodService:
    return NasaApodService(
        http=http,
        cache=cache,
        api_key="test-key",
        base_url="https://api.test",
    )


@pytest.mark.asyncio
async def test_get_returns_cached_payload_without_http(cache: JsonCache) -> None:
    target = date(2026, 5, 1)
    await cache.set(_cache_key(target), _sample(target), CACHE_TTL_SECONDS)

    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(500)

    async with _client(handler) as http:
        service = _service(http, cache)
        result = await service.get(target)

    assert result.title == f"Title {target}"
    assert calls == 0


@pytest.mark.asyncio
async def test_get_fetches_and_caches_on_miss(cache: JsonCache) -> None:
    target = date(2026, 5, 1)
    seen_params: dict[str, Any] = {}

    def handler(request: httpx.Request) -> httpx.Response:
        seen_params.update(dict(request.url.params))
        return httpx.Response(200, json=_sample(target))

    async with _client(handler) as http:
        service = _service(http, cache)
        result = await service.get(target)

    assert result.date == target
    assert seen_params["date"] == target.isoformat()
    assert seen_params["api_key"] == "test-key"
    assert await cache.get(_cache_key(target)) is not None


@pytest.mark.asyncio
async def test_get_caches_negative_on_upstream_error(cache: JsonCache) -> None:
    target = date(2026, 5, 1)

    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(500)

    async with _client(handler) as http:
        service = _service(http, cache)
        with pytest.raises(HTTPException) as exc_info:
            await service.get(target)

    assert exc_info.value.status_code == 502
    assert await cache.get(_cache_key(target)) == NEGATIVE_SENTINEL


@pytest.mark.asyncio
async def test_get_timeout_does_not_cache_negative(cache: JsonCache) -> None:
    target = date(2026, 5, 1)

    def handler(request: httpx.Request) -> httpx.Response:
        raise httpx.ReadTimeout("slow", request=request)

    async with _client(handler) as http:
        service = _service(http, cache)
        with pytest.raises(HTTPException) as exc_info:
            await service.get(target)

    assert exc_info.value.status_code == 502
    # A timeout is transient slowness, not a missing date — leave the cache clear.
    assert await cache.get(_cache_key(target)) is None


@pytest.mark.asyncio
async def test_get_retries_transient_failure_then_succeeds(cache: JsonCache) -> None:
    target = date(2026, 5, 1)
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        if calls == 1:
            return httpx.Response(503)
        return httpx.Response(200, json=_sample(target))

    async with _client(handler) as http:
        service = _service(http, cache)
        result = await service.get(target)

    assert result.date == target
    assert calls == 2
    assert await cache.get(_cache_key(target)) is not None


@pytest.mark.asyncio
async def test_get_retries_404_then_maps_to_not_found(cache: JsonCache) -> None:
    target = date(2026, 5, 1)
    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(404)

    async with _client(handler) as http:
        service = _service(http, cache)
        with pytest.raises(HTTPException) as exc_info:
            await service.get(target)

    assert exc_info.value.status_code == 404
    assert calls == 3
    assert await cache.get(_cache_key(target)) is None


@pytest.mark.asyncio
async def test_latest_falls_back_to_previous_day(cache: JsonCache) -> None:
    today = _today_utc()
    yesterday = today - timedelta(days=1)

    def handler(request: httpx.Request) -> httpx.Response:
        requested = request.url.params.get("date")
        if requested == yesterday.isoformat():
            return httpx.Response(200, json=_sample(yesterday))
        return httpx.Response(404)

    async with _client(handler) as http:
        result = await _service(http, cache).get(None)

    assert result.date == yesterday


@pytest.mark.asyncio
async def test_get_raises_when_negative_cached(cache: JsonCache) -> None:
    target = date(2026, 5, 1)
    await cache.set(_cache_key(target), NEGATIVE_SENTINEL, NEGATIVE_CACHE_TTL_SECONDS)

    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(200, json=_sample(target))

    async with _client(handler) as http:
        service = _service(http, cache)
        with pytest.raises(HTTPException) as exc_info:
            await service.get(target)

    assert exc_info.value.status_code == 502
    assert calls == 0


@pytest.mark.asyncio
async def test_get_rejects_pre_epoch(cache: JsonCache) -> None:
    async with _client(lambda _: httpx.Response(500)) as http:
        service = _service(http, cache)
        with pytest.raises(HTTPException) as exc_info:
            await service.get(APOD_EPOCH - timedelta(days=1))
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_get_rejects_future_date(cache: JsonCache) -> None:
    async with _client(lambda _: httpx.Response(500)) as http:
        service = _service(http, cache)
        with pytest.raises(HTTPException) as exc_info:
            await service.get(_today_utc() + timedelta(days=1))
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_get_range_uses_cache_for_partial_hits(cache: JsonCache) -> None:
    start = date(2026, 5, 1)
    end = date(2026, 5, 3)
    middle = date(2026, 5, 2)
    await cache.set(_cache_key(middle), _sample(middle), CACHE_TTL_SECONDS)

    fetched_params: list[dict[str, Any]] = []

    def handler(request: httpx.Request) -> httpx.Response:
        fetched_params.append(dict(request.url.params))
        return httpx.Response(
            200,
            json=[_sample(start), _sample(end)],
        )

    async with _client(handler) as http:
        service = _service(http, cache)
        results = await service.get_range(start, end)

    assert [r.date for r in results] == [start, middle, end]
    assert len(fetched_params) == 1
    assert fetched_params[0]["start_date"] == start.isoformat()
    assert fetched_params[0]["end_date"] == end.isoformat()
    assert await cache.get(_cache_key(start)) is not None
    assert await cache.get(_cache_key(end)) is not None


@pytest.mark.asyncio
async def test_get_range_skips_http_when_all_cached(cache: JsonCache) -> None:
    start = date(2026, 5, 1)
    end = date(2026, 5, 2)
    await cache.set(_cache_key(start), _sample(start), CACHE_TTL_SECONDS)
    await cache.set(_cache_key(end), _sample(end), CACHE_TTL_SECONDS)

    calls = 0

    def handler(_: httpx.Request) -> httpx.Response:
        nonlocal calls
        calls += 1
        return httpx.Response(500)

    async with _client(handler) as http:
        service = _service(http, cache)
        results = await service.get_range(start, end)

    assert calls == 0
    assert [r.date for r in results] == [start, end]


@pytest.mark.asyncio
async def test_get_range_rejects_too_wide(cache: JsonCache) -> None:
    start = date(2026, 1, 1)
    end = start + timedelta(days=60)

    async with _client(lambda _: httpx.Response(500)) as http:
        service = _service(http, cache)
        with pytest.raises(HTTPException) as exc_info:
            await service.get_range(start, end)
    assert exc_info.value.status_code == 400


@pytest.mark.asyncio
async def test_get_range_rejects_inverted(cache: JsonCache) -> None:
    async with _client(lambda _: httpx.Response(500)) as http:
        service = _service(http, cache)
        with pytest.raises(HTTPException) as exc_info:
            await service.get_range(date(2026, 5, 5), date(2026, 5, 1))
    assert exc_info.value.status_code == 400
