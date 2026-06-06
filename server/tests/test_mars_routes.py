from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers.mars import get_mars_service
from app.services.cache import JsonCache
from app.services.mars import MarsPhotoService


def _raw(image_id: str = "img1") -> dict[str, Any]:
    return {
        "imageid": image_id,
        "sol": 1882,
        "date_taken_utc": "2026-06-06T12:00:00.000",
        "camera": {"instrument": "MCZ_LEFT"},
        "image_files": {"small": "https://mars.test/s.jpg", "large": "https://mars.test/l.jpg"},
        "sample_type": "Full",
    }


@pytest_asyncio.fixture
async def mars_client() -> AsyncIterator[AsyncClient]:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"images": [_raw("a"), _raw("b")]})

    upstream = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    service = MarsPhotoService(
        http=upstream,
        cache=JsonCache(FakeRedis(decode_responses=True)),
        base_url="https://mars.test",
    )
    app.dependency_overrides[get_mars_service] = lambda: service
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    await upstream.aclose()


@pytest.mark.asyncio
async def test_photos_happy_path(mars_client: AsyncClient) -> None:
    response = await mars_client.get("/mars/photos")
    assert response.status_code == 200
    body = response.json()
    assert [p["id"] for p in body] == ["a", "b"]
    assert body[0]["camera"] == "MCZ_LEFT"
    assert body[0]["rover"] == "Perseverance"


@pytest.mark.asyncio
async def test_photos_second_page(mars_client: AsyncClient) -> None:
    response = await mars_client.get("/mars/photos", params={"page": 2})
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_photos_rejects_bad_page(mars_client: AsyncClient) -> None:
    response = await mars_client.get("/mars/photos", params={"page": 0})
    assert response.status_code == 422
