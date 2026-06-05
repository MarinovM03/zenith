from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers.launch import get_launch_service
from app.services.cache import JsonCache
from app.services.launch import LaunchService


def _raw(launch_id: str = "abc") -> dict[str, Any]:
    return {
        "id": launch_id,
        "name": "Falcon 9 | Starlink",
        "status": {"name": "Go for Launch", "abbrev": "Go"},
        "net": "2026-07-01T12:00:00Z",
        "launch_service_provider": {"name": "SpaceX"},
        "rocket": {"configuration": {"name": "Falcon 9"}},
        "mission": {"name": "Starlink", "description": "Sats."},
        "pad": {"name": "SLC-40", "location": {"name": "Cape Canaveral"}},
        "image": "https://example.test/rocket.jpg",
        "vidURLs": [{"url": "https://youtube.test/live"}],
    }


@pytest_asyncio.fixture
async def launch_client() -> AsyncIterator[AsyncClient]:
    def handler(request: httpx.Request) -> httpx.Response:
        path = request.url.path
        if path.endswith("/upcoming/") or path.endswith("/previous/"):
            return httpx.Response(200, json={"results": [_raw("a"), _raw("b")]})
        launch_id = path.rstrip("/").rsplit("/", 1)[-1]
        if launch_id == "missing":
            return httpx.Response(404)
        return httpx.Response(200, json=_raw(launch_id))

    upstream = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    service = LaunchService(
        http=upstream,
        cache=JsonCache(FakeRedis(decode_responses=True)),
        base_url="https://ll.test/2.2.0",
    )
    app.dependency_overrides[get_launch_service] = lambda: service
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    await upstream.aclose()


@pytest.mark.asyncio
async def test_upcoming_happy_path(launch_client: AsyncClient) -> None:
    response = await launch_client.get("/launches/upcoming")
    assert response.status_code == 200
    body = response.json()
    assert [item["id"] for item in body] == ["a", "b"]
    assert body[0]["rocket"] == "Falcon 9"


@pytest.mark.asyncio
async def test_previous_happy_path(launch_client: AsyncClient) -> None:
    response = await launch_client.get("/launches/previous", params={"limit": 3})
    assert response.status_code == 200
    assert len(response.json()) == 2


@pytest.mark.asyncio
async def test_detail_happy_path(launch_client: AsyncClient) -> None:
    response = await launch_client.get("/launches/some-id")
    assert response.status_code == 200
    assert response.json()["id"] == "some-id"


@pytest.mark.asyncio
async def test_detail_not_found(launch_client: AsyncClient) -> None:
    response = await launch_client.get("/launches/missing")
    assert response.status_code == 404


@pytest.mark.asyncio
async def test_upcoming_rejects_excessive_limit(launch_client: AsyncClient) -> None:
    response = await launch_client.get("/launches/upcoming", params={"limit": 999})
    assert response.status_code == 422
