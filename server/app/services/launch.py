import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.schemas.launch import Launch
from app.services.cache import JsonCache
from app.services.upstream import NEGATIVE_SENTINEL, request_json

logger = logging.getLogger(__name__)

UPCOMING_TTL_SECONDS = 10 * 60
PREVIOUS_TTL_SECONDS = 24 * 60 * 60
DETAIL_TTL_SECONDS = 24 * 60 * 60
NEGATIVE_CACHE_TTL_SECONDS = 60

UPSTREAM_RETRIES = 2
UPSTREAM_BACKOFF_SECONDS = 0.5
UPSTREAM_TIMEOUT_SECONDS = 10.0


def _first(value: Any) -> dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _normalise(raw: dict[str, Any]) -> dict[str, Any]:
    """Flatten Launch Library's deeply nested payload into the fields we expose."""
    status_ = _first(raw.get("status"))
    provider = _first(raw.get("launch_service_provider"))
    rocket = _first(_first(raw.get("rocket")).get("configuration"))
    mission = _first(raw.get("mission"))
    pad = _first(raw.get("pad"))
    location = _first(pad.get("location"))
    videos = raw.get("vidURLs") or []
    webcast = videos[0].get("url") if videos and isinstance(videos[0], dict) else None
    return {
        "id": raw["id"],
        "name": raw["name"],
        "status": {
            "name": status_.get("name", "Unknown"),
            "abbrev": status_.get("abbrev", "TBD"),
        },
        "net": raw["net"],
        "provider": provider.get("name"),
        "rocket": rocket.get("name"),
        "mission": mission.get("name"),
        "mission_description": mission.get("description"),
        "pad": pad.get("name"),
        "location": location.get("name"),
        "image": raw.get("image"),
        "webcast_url": webcast,
    }


class LaunchService:
    def __init__(self, http: httpx.AsyncClient, cache: JsonCache, base_url: str) -> None:
        self._http = http
        self._cache = cache
        self._base_url = base_url.rstrip("/")

    async def get_upcoming(self, limit: int) -> list[Launch]:
        return await self._get_list(
            cache_key=f"launches:upcoming:{limit}",
            path="/launch/upcoming/",
            limit=limit,
            ttl=UPCOMING_TTL_SECONDS,
        )

    async def get_previous(self, limit: int) -> list[Launch]:
        return await self._get_list(
            cache_key=f"launches:previous:{limit}",
            path="/launch/previous/",
            limit=limit,
            ttl=PREVIOUS_TTL_SECONDS,
        )

    async def get_detail(self, launch_id: str) -> Launch:
        cache_key = f"launches:detail:{launch_id}"
        cached = await self._cache.get(cache_key)
        if cached == NEGATIVE_SENTINEL:
            raise self._unavailable()
        if cached is not None:
            return Launch.model_validate(cached)

        try:
            raw = await self._request(f"/launch/{launch_id}/", params=None)
        except httpx.HTTPError as exc:
            if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND, detail="launch not found"
                ) from exc
            await self._cache.set(cache_key, NEGATIVE_SENTINEL, NEGATIVE_CACHE_TTL_SECONDS)
            logger.warning("Launch Library detail fetch failed for %s: %s", launch_id, exc)
            raise self._unavailable() from exc

        payload = _normalise(raw)
        await self._cache.set(cache_key, payload, DETAIL_TTL_SECONDS)
        return Launch.model_validate(payload)

    async def _get_list(self, cache_key: str, path: str, limit: int, ttl: int) -> list[Launch]:
        cached = await self._cache.get(cache_key)
        if cached == NEGATIVE_SENTINEL:
            raise self._unavailable()
        if cached is not None:
            return [Launch.model_validate(item) for item in cached]

        try:
            raw = await self._request(path, params={"limit": limit, "mode": "normal"})
        except httpx.HTTPError as exc:
            await self._cache.set(cache_key, NEGATIVE_SENTINEL, NEGATIVE_CACHE_TTL_SECONDS)
            logger.warning("Launch Library fetch failed for %s: %s", path, exc)
            raise self._unavailable() from exc

        payload = [_normalise(item) for item in raw.get("results", [])]
        await self._cache.set(cache_key, payload, ttl)
        return [Launch.model_validate(item) for item in payload]

    async def _request(self, path: str, params: dict[str, Any] | None) -> Any:
        return await request_json(
            self._http,
            f"{self._base_url}{path}",
            params=params,
            retries=UPSTREAM_RETRIES,
            backoff_seconds=UPSTREAM_BACKOFF_SECONDS,
            timeout_seconds=UPSTREAM_TIMEOUT_SECONDS,
        )

    @staticmethod
    def _unavailable() -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="upstream launch data unavailable",
        )
