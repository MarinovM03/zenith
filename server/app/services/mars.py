import logging
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.schemas.mars import MarsPhoto
from app.services.cache import JsonCache
from app.services.upstream import NEGATIVE_SENTINEL, request_json

logger = logging.getLogger(__name__)

# NASA's official raw-image feed. Perseverance (mars2020) is the active rover
# with a maintained feed; the older mars-photos API was decommissioned.
CATEGORY = "mars2020"
ROVER = "Perseverance"
PER_PAGE = 24

CACHE_TTL_SECONDS = 24 * 60 * 60
NEGATIVE_CACHE_TTL_SECONDS = 60

# A cold deep page takes ~15-20s from mars.nasa.gov's origin before its CDN
# caches it, so a tight timeout never lets pages past the first one land in our
# cache. Wait long enough to fetch them once; retrying slowness adds little, so
# keep retries low (one extra attempt often catches the now-warmed page).
UPSTREAM_RETRIES = 1
UPSTREAM_BACKOFF_SECONDS = 0.5
UPSTREAM_TIMEOUT_SECONDS = 25.0


def _pick(files: dict[str, Any], *keys: str) -> str:
    for key in keys:
        value = files.get(key)
        if value:
            return value
    return ""


def _normalise(raw: dict[str, Any]) -> dict[str, Any]:
    files = raw.get("image_files") or {}
    camera = raw.get("camera") or {}
    utc = raw.get("date_taken_utc") or ""
    return {
        "id": raw.get("imageid") or "",
        "sol": raw.get("sol") or 0,
        "earth_date": utc[:10] or None,
        "camera": camera.get("instrument") or "Camera",
        "img_src": _pick(files, "small", "medium", "large", "full_res"),
        "full_src": _pick(files, "large", "full_res", "medium", "small"),
        "rover": ROVER,
    }


class MarsPhotoService:
    def __init__(self, http: httpx.AsyncClient, cache: JsonCache, base_url: str) -> None:
        self._http = http
        self._cache = cache
        self._base_url = base_url.rstrip("/")

    async def get_photos(self, page: int) -> list[MarsPhoto]:
        cache_key = f"mars:{CATEGORY}:{page}"
        cached = await self._cache.get(cache_key)
        if cached == NEGATIVE_SENTINEL:
            raise self._unavailable()
        if cached is not None:
            return [MarsPhoto.model_validate(item) for item in cached]

        try:
            raw = await self._request(page)
        except httpx.TimeoutException as exc:
            # A timeout means "slow", not "gone": don't poison the cache, so a
            # user's retry reaches the upstream again (often now warm).
            logger.warning("Mars photos timed out (page %s): %s", page, exc)
            raise self._unavailable() from exc
        except httpx.HTTPError as exc:
            await self._cache.set(cache_key, NEGATIVE_SENTINEL, NEGATIVE_CACHE_TTL_SECONDS)
            logger.warning("Mars photos fetch failed (page %s): %s", page, exc)
            raise self._unavailable() from exc

        images = raw.get("images") or []
        payload = [item for item in (_normalise(i) for i in images) if item["img_src"]]
        await self._cache.set(cache_key, payload, CACHE_TTL_SECONDS)
        return [MarsPhoto.model_validate(item) for item in payload]

    async def _request(self, page: int) -> Any:
        return await request_json(
            self._http,
            f"{self._base_url}/rss/api/",
            params={
                "feed": "raw_images",
                "category": CATEGORY,
                "feedtype": "json",
                "num": PER_PAGE,
                "page": page - 1,
                "order": "sol desc",
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
