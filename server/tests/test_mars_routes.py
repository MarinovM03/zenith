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


def _raw(photo_id: int = 1) -> dict[str, Any]:
    return {
        "id": photo_id,
        "sol": 1000,
        "earth_date": "2024-01-01",
        "camera": {"name": "NAVCAM", "full_name": "Navigation Camera"},
        "img_src": "https://mars.test/img.jpg",
        "rover": {"name": "Curiosity"},
    }


@pytest_asyncio.fixture
async def mars_client() -> AsyncIterator[AsyncClient]:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json={"photos": [_raw(1), _raw(2)]})

    upstream = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    service = MarsPhotoService(
        http=upstream,
        cache=JsonCache(FakeRedis(decode_responses=True)),
        api_key="key",
        base_url="https://api.test",
    )
    app.dependency_overrides[get_mars_service] = lambda: service
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    await upstream.aclose()


@pytest.mark.asyncio
async def test_photos_happy_path(mars_client: AsyncClient) -> None:
    response = await mars_client.get("/mars/photos", params={"date": "2024-01-01"})
    assert response.status_code == 200
    body = response.json()
    assert [p["id"] for p in body] == [1, 2]
    assert body[0]["camera"] == "Navigation Camera"


@pytest.mark.asyncio
async def test_photos_requires_date(mars_client: AsyncClient) -> None:
    response = await mars_client.get("/mars/photos")
    assert response.status_code == 422


@pytest.mark.asyncio
async def test_photos_rejects_unknown_rover(mars_client: AsyncClient) -> None:
    response = await mars_client.get(
        "/mars/photos", params={"date": "2024-01-01", "rover": "rover-x"}
    )
    assert response.status_code == 400


@pytest.mark.asyncio
async def test_photos_rejects_bad_page(mars_client: AsyncClient) -> None:
    response = await mars_client.get("/mars/photos", params={"date": "2024-01-01", "page": 0})
    assert response.status_code == 422
