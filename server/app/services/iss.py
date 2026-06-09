import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.schemas.iss import IssPosition
from app.services.cache import JsonCache
from app.services.upstream import request_json

logger = logging.getLogger(__name__)

SATELLITE_ID = 25544
CACHE_KEY = "iss:position"
CACHE_TTL_SECONDS = 2

UPSTREAM_RETRIES = 1
UPSTREAM_BACKOFF_SECONDS = 0.3
UPSTREAM_TIMEOUT_SECONDS = 12.0


def _normalise(raw: dict[str, Any]) -> dict[str, Any]:
    return {
        "latitude": raw["latitude"],
        "longitude": raw["longitude"],
        "altitude_km": raw["altitude"],
        "velocity_kph": raw["velocity"],
        "visibility": raw.get("visibility") or "unknown",
        "timestamp": raw["timestamp"],
    }


class IssService:
    def __init__(self, http: httpx.AsyncClient, cache: JsonCache, base_url: str) -> None:
        self._http = http
        self._cache = cache
        self._base_url = base_url.rstrip("/")

    async def get_position(self) -> IssPosition:
        cached = await self._cache.get(CACHE_KEY)
        if cached is not None:
            return IssPosition.model_validate(cached)

        try:
            raw = await self._request()
        except httpx.HTTPError as exc:
            logger.warning("ISS position fetch failed: %s", exc)
            raise self._unavailable() from exc

        payload = _normalise(raw)
        await self._cache.set(CACHE_KEY, payload, CACHE_TTL_SECONDS)
        return IssPosition.model_validate(payload)

    async def _request(self) -> Any:
        return await request_json(
            self._http,
            f"{self._base_url}/satellites/{SATELLITE_ID}",
            retries=UPSTREAM_RETRIES,
            backoff_seconds=UPSTREAM_BACKOFF_SECONDS,
            timeout_seconds=UPSTREAM_TIMEOUT_SECONDS,
        )

    @staticmethod
    def _unavailable() -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="upstream ISS position unavailable",
        )
