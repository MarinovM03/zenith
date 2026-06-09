from collections.abc import AsyncIterator
from typing import Any

import httpx
import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers.iss import get_iss_service
from app.services.cache import JsonCache
from app.services.iss import IssService


def _raw() -> dict[str, Any]:
    return {
        "latitude": 20.5,
        "longitude": -75.7,
        "altitude": 413.3,
        "velocity": 27607.5,
        "visibility": "daylight",
        "timestamp": 1780954224,
    }


@pytest_asyncio.fixture
async def iss_client() -> AsyncIterator[AsyncClient]:
    def handler(_: httpx.Request) -> httpx.Response:
        return httpx.Response(200, json=_raw())

    upstream = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    service = IssService(
        http=upstream,
        cache=JsonCache(FakeRedis(decode_responses=True)),
        base_url="https://iss.test/v1",
    )
    app.dependency_overrides[get_iss_service] = lambda: service
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()
    await upstream.aclose()


@pytest.mark.asyncio
async def test_iss_happy_path(iss_client: AsyncClient) -> None:
    response = await iss_client.get("/iss")
    assert response.status_code == 200
    body = response.json()
    assert body["latitude"] == 20.5
    assert body["altitude_km"] == 413.3
    assert body["velocity_kph"] == 27607.5
    assert body["visibility"] == "daylight"
