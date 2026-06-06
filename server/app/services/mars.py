import logging
from datetime import date
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.schemas.mars import MarsPhoto
from app.services.cache import JsonCache
from app.services.upstream import NEGATIVE_SENTINEL, request_json

logger = logging.getLogger(__name__)

ROVERS = frozenset({"curiosity", "opportunity", "spirit"})
CACHE_TTL_SECONDS = 24 * 60 * 60
NEGATIVE_CACHE_TTL_SECONDS = 60

UPSTREAM_RETRIES = 2
UPSTREAM_BACKOFF_SECONDS = 0.5
UPSTREAM_TIMEOUT_SECONDS = 10.0


def _https(url: str) -> str:
    """Some rover image URLs are served over http; force https so they aren't
    blocked as mixed content when the app is served over https."""
    return "https://" + url[len("http://") :] if url.startswith("http://") else url


def _normalise(raw: dict[str, Any]) -> dict[str, Any]:
    camera = raw.get("camera") or {}
    rover = raw.get("rover") or {}
    return {
        "id": raw["id"],
        "sol": raw["sol"],
        "earth_date": raw["earth_date"],
        "camera": camera.get("full_name") or camera.get("name") or "Camera",
        "camera_abbrev": camera.get("name") or "CAM",
        "img_src": _https(raw["img_src"]),
        "rover": rover.get("name") or "Unknown",
    }


class MarsPhotoService:
    def __init__(
        self,
        http: httpx.AsyncClient,
        cache: JsonCache,
        api_key: str,
        base_url: str,
    ) -> None:
        self._http = http
        self._cache = cache
        self._api_key = api_key
        self._base_url = base_url.rstrip("/")

    async def get_photos(self, rover: str, day: date, page: int) -> list[MarsPhoto]:
        rover = rover.lower()
        if rover not in ROVERS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"unknown rover; choose one of {sorted(ROVERS)}",
            )

        cache_key = f"mars:{rover}:{day.isoformat()}:{page}"
        cached = await self._cache.get(cache_key)
        if cached == NEGATIVE_SENTINEL:
            raise self._unavailable()
        if cached is not None:
            return [MarsPhoto.model_validate(item) for item in cached]

        try:
            raw = await self._request(rover, day, page)
        except httpx.HTTPError as exc:
            await self._cache.set(cache_key, NEGATIVE_SENTINEL, NEGATIVE_CACHE_TTL_SECONDS)
            logger.warning("Mars photos fetch failed for %s %s: %s", rover, day, exc)
            raise self._unavailable() from exc

        payload = [_normalise(item) for item in raw.get("photos", [])]
        await self._cache.set(cache_key, payload, CACHE_TTL_SECONDS)
        return [MarsPhoto.model_validate(item) for item in payload]

    async def _request(self, rover: str, day: date, page: int) -> Any:
        return await request_json(
            self._http,
            f"{self._base_url}/mars-photos/api/v1/rovers/{rover}/photos",
            params={
                "earth_date": day.isoformat(),
                "page": page,
                "api_key": self._api_key,
            },
            retries=UPSTREAM_RETRIES,
            backoff_seconds=UPSTREAM_BACKOFF_SECONDS,
            timeout_seconds=UPSTREAM_TIMEOUT_SECONDS,
        )

    @staticmethod
    def _unavailable() -> HTTPException:
        return HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="upstream Mars photos unavailable",
        )
