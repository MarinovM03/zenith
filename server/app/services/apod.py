import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.schemas.apod import Apod
from app.services.cache import JsonCache
from app.services.upstream import NEGATIVE_SENTINEL, request_json

logger = logging.getLogger(__name__)

APOD_EPOCH = date(1995, 6, 16)
CACHE_TTL_SECONDS = 24 * 60 * 60
NEGATIVE_CACHE_TTL_SECONDS = 20
MAX_RANGE_DAYS = 30
LATEST_FALLBACK_DAYS = 3

UPSTREAM_RETRIES = 2
UPSTREAM_BACKOFF_SECONDS = 0.5
# api.nasa.gov answers in under a second when healthy but occasionally stalls;
# give it room beyond the old 10s without inviting a very long hang.
UPSTREAM_TIMEOUT_SECONDS = 15.0


def _today_utc() -> date:
    return datetime.now(UTC).date()


def _cache_key(day: date) -> str:
    return f"apod:{day.isoformat()}"


def _validate_date(day: date) -> None:
    if day < APOD_EPOCH:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"APOD starts on {APOD_EPOCH.isoformat()}",
        )
    if day > _today_utc():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="date is in the future",
        )


def _normalise(raw: dict[str, Any]) -> dict[str, Any]:
    """NASA sometimes omits hdurl/copyright; for videos it adds thumbnail_url
    when we pass thumbs=True. Keep only the fields we expose."""
    return {
        "date": raw["date"],
        "title": raw["title"],
        "explanation": raw["explanation"],
        "url": raw["url"],
        "hdurl": raw.get("hdurl"),
        "media_type": raw.get("media_type", "image"),
        "copyright": raw.get("copyright"),
        "thumbnail_url": raw.get("thumbnail_url"),
    }


class NasaApodService:
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

    async def get(self, day: date | None = None) -> Apod:
        if day is not None:
            _validate_date(day)
            return await self._get_one(day)

        # No date given: serve the most recent available picture. "Today" may
        # not be posted yet, so fall back through the previous few days.
        target = _today_utc()
        earliest = target - timedelta(days=LATEST_FALLBACK_DAYS)
        while target >= earliest:
            try:
                return await self._get_one(target)
            except HTTPException as exc:
                if exc.status_code != status.HTTP_404_NOT_FOUND:
                    raise
                target -= timedelta(days=1)
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="upstream APOD unavailable",
        )

    async def _get_one(self, target: date) -> Apod:
        cached = await self._cache.get(_cache_key(target))
        if cached == NEGATIVE_SENTINEL:
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="upstream APOD unavailable",
            )
        if cached is not None:
            return Apod.model_validate(cached)

        try:
            raw = await self._fetch_single(target)
        except httpx.HTTPError as exc:
            if isinstance(exc, httpx.HTTPStatusError) and exc.response.status_code == 404:
                raise HTTPException(
                    status_code=status.HTTP_404_NOT_FOUND,
                    detail="no APOD for this date",
                ) from exc
            if not isinstance(exc, httpx.TimeoutException):
                # A timeout is transient slowness, not a missing/broken date, so
                # skip the negative cache and let a retry reach the upstream.
                await self._cache.set(
                    _cache_key(target), NEGATIVE_SENTINEL, NEGATIVE_CACHE_TTL_SECONDS
                )
            logger.warning("NASA APOD fetch failed for %s: %s", target, exc)
            raise HTTPException(
                status_code=status.HTTP_502_BAD_GATEWAY,
                detail="upstream APOD unavailable",
            ) from exc

        payload = _normalise(raw)
        await self._cache.set(_cache_key(target), payload, CACHE_TTL_SECONDS)
        return Apod.model_validate(payload)

    async def get_range(self, start: date, end: date) -> list[Apod]:
        if end < start:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="end must be on or after start",
            )
        if (end - start).days + 1 > MAX_RANGE_DAYS:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail=f"range capped at {MAX_RANGE_DAYS} days",
            )
        _validate_date(start)
        _validate_date(end)

        days: list[date] = [start + timedelta(days=i) for i in range((end - start).days + 1)]

        results: dict[date, dict[str, Any]] = {}
        missing: list[date] = []
        for day in days:
            cached = await self._cache.get(_cache_key(day))
            if cached is None or cached == NEGATIVE_SENTINEL:
                missing.append(day)
            else:
                results[day] = cached

        if missing:
            fetch_start = min(missing)
            fetch_end = max(missing)
            try:
                raw_list = await self._fetch_range(fetch_start, fetch_end)
            except httpx.HTTPError as exc:
                if not isinstance(exc, httpx.TimeoutException):
                    for day in missing:
                        await self._cache.set(
                            _cache_key(day), NEGATIVE_SENTINEL, NEGATIVE_CACHE_TTL_SECONDS
                        )
                logger.warning(
                    "NASA APOD range fetch failed for %s..%s: %s", fetch_start, fetch_end, exc
                )
                raise HTTPException(
                    status_code=status.HTTP_502_BAD_GATEWAY,
                    detail="upstream APOD unavailable",
                ) from exc

            for raw in raw_list:
                payload = _normalise(raw)
                day = date.fromisoformat(payload["date"])
                results[day] = payload
                await self._cache.set(_cache_key(day), payload, CACHE_TTL_SECONDS)

        return [Apod.model_validate(results[d]) for d in days if d in results]

    async def _fetch_single(self, day: date) -> dict[str, Any]:
        return await self._request(
            {
                "api_key": self._api_key,
                "date": day.isoformat(),
                "thumbs": "true",
            },
            retry_on_404=True,
        )

    async def _fetch_range(self, start: date, end: date) -> list[dict[str, Any]]:
        return await self._request(
            {
                "api_key": self._api_key,
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
                "thumbs": "true",
            }
        )

    async def _request(self, params: dict[str, Any], *, retry_on_404: bool = False) -> Any:
        return await request_json(
            self._http,
            f"{self._base_url}/planetary/apod",
            params=params,
            retries=UPSTREAM_RETRIES,
            backoff_seconds=UPSTREAM_BACKOFF_SECONDS,
            timeout_seconds=UPSTREAM_TIMEOUT_SECONDS,
            retry_on_404=retry_on_404,
        )
