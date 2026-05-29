import pytest
from fakeredis.aioredis import FakeRedis

from app.services.cache import JsonCache


@pytest.fixture
def cache() -> JsonCache:
    return JsonCache(FakeRedis(decode_responses=True))


@pytest.mark.asyncio
async def test_get_missing_returns_none(cache: JsonCache) -> None:
    assert await cache.get("missing") is None


@pytest.mark.asyncio
async def test_set_then_get_roundtrips_dict(cache: JsonCache) -> None:
    payload = {"a": 1, "b": [2, 3], "c": {"nested": True}}
    await cache.set("key", payload, ttl_seconds=60)
    assert await cache.get("key") == payload


@pytest.mark.asyncio
async def test_set_then_get_roundtrips_list(cache: JsonCache) -> None:
    payload = [{"id": 1}, {"id": 2}]
    await cache.set("key", payload, ttl_seconds=60)
    assert await cache.get("key") == payload


@pytest.mark.asyncio
async def test_delete_removes_key(cache: JsonCache) -> None:
    await cache.set("key", {"x": 1}, ttl_seconds=60)
    await cache.delete("key")
    assert await cache.get("key") is None
