from collections.abc import AsyncIterator
from datetime import date, timedelta

import httpx
import pytest
import pytest_asyncio
from fakeredis.aioredis import FakeRedis
from httpx import ASGITransport, AsyncClient

from app.main import app
from app.routers.apod import get_apod_service
from app.services.apod import NasaApodService, _today_utc
from app.services.cache import JsonCache


def _sample(day: date) -> dict[str, object]:
    return {
        "date": day.isoformat(),
        "title": f"Title {day}",
        "explanation": "An explanation.",
        "url": "https://example.test/img.jpg",
        "hdurl": "https://example.test/img-hd.jpg",
        "media_type": "image",
        "copyright": "Some Photographer",
    }


@pytest_asyncio.fixture
async def apod_client() -> AsyncIterator[tuple[AsyncClient, dict[str, int]]]:
    counts = {"calls": 0}

    def handler(request: httpx.Request) -> httpx.Response:
        counts["calls"] += 1
        params = request.url.params
        if "start_date" in params:
            start = date.fromisoformat(params["start_date"])
            end = date.fromisoformat(params["end_date"])
            days = (end - start).days + 1
            return httpx.Response(
                200,
                json=[_sample(start + timedelta(days=i)) for i in range(days)],
            )
        if "date" in params:
            return httpx.Response(200, json=_sample(date.fromisoformat(params["date"])))
        return httpx.Response(200, json=_sample(_today_utc()))

    transport = httpx.MockTransport(handler)
    upstream = httpx.AsyncClient(transport=transport)
    cache = JsonCache(FakeRedis(decode_responses=True))
    service = NasaApodService(
        http=upstream,
        cache=cache,
        api_key="test-key",
        base_url="https://api.test",
    )

    app.dependency_overrides[get_apod_service] = lambda: service
    async with AsyncClient(transport=ASGITransport(app=app), base_url="http://test") as ac:
        yield ac, counts
    app.dependency_overrides.clear()
    await upstream.aclose()


@pytest.mark.asyncio
async def test_get_apod_today_happy_path(
    apod_client: tuple[AsyncClient, dict[str, int]],
) -> None:
    client, counts = apod_client
    response = await client.get("/apod")

    assert response.status_code == 200
    body = response.json()
    assert body["date"] == _today_utc().isoformat()
    assert body["media_type"] == "image"
    assert counts["calls"] == 1


@pytest.mark.asyncio
async def test_get_apod_specific_date(
    apod_client: tuple[AsyncClient, dict[str, int]],
) -> None:
    client, _ = apod_client
    response = await client.get("/apod", params={"date": "2026-05-01"})

    assert response.status_code == 200
    assert response.json()["date"] == "2026-05-01"


@pytest.mark.asyncio
async def test_get_apod_rejects_future_date(
    apod_client: tuple[AsyncClient, dict[str, int]],
) -> None:
    client, _ = apod_client
    future = (_today_utc() + timedelta(days=2)).isoformat()
    response = await client.get("/apod", params={"date": future})

    assert response.status_code == 400


@pytest.mark.asyncio
async def test_get_apod_rejects_malformed_date(
    apod_client: tuple[AsyncClient, dict[str, int]],
) -> None:
    client, _ = apod_client
    response = await client.get("/apod", params={"date": "not-a-date"})

    assert response.status_code == 422


@pytest.mark.asyncio
async def test_get_apod_range_happy_path(
    apod_client: tuple[AsyncClient, dict[str, int]],
) -> None:
    client, counts = apod_client
    response = await client.get(
        "/apod/range",
        params={"start": "2026-05-01", "end": "2026-05-03"},
    )

    assert response.status_code == 200
    body = response.json()
    assert [item["date"] for item in body] == ["2026-05-01", "2026-05-02", "2026-05-03"]
    assert counts["calls"] == 1


@pytest.mark.asyncio
async def test_get_apod_range_rejects_too_wide(
    apod_client: tuple[AsyncClient, dict[str, int]],
) -> None:
    client, _ = apod_client
    response = await client.get(
        "/apod/range",
        params={"start": "2026-01-01", "end": "2026-03-01"},
    )

    assert response.status_code == 400
