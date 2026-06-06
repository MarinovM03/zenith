import logging
from datetime import UTC, date, datetime, timedelta
from typing import Any

import httpx
from fastapi import HTTPException, status

from app.schemas.asteroid import Asteroid
from app.services.cache import JsonCache
from app.services.upstream import NEGATIVE_SENTINEL, request_json

logger = logging.getLogger(__name__)

MAX_RANGE_DAYS = 7
CACHE_TTL_SECONDS = 6 * 60 * 60
NEGATIVE_CACHE_TTL_SECONDS = 60

UPSTREAM_RETRIES = 2
UPSTREAM_BACKOFF_SECONDS = 0.5
UPSTREAM_TIMEOUT_SECONDS = 10.0


def _today_utc() -> date:
    return datetime.now(UTC).date()


def _to_float(value: Any) -> float:
    try:
        return float(value)
    except (TypeError, ValueError):
        return 0.0


def _normalise(neo: dict[str, Any], date_key: str) -> dict[str, Any]:
    approaches = neo.get("close_approach_data") or []
    approach = next(
        (a for a in approaches if a.get("close_approach_date") == date_key),
        approaches[0] if approaches else {},
    )
    diameter = (neo.get("estimated_diameter") or {}).get("meters") or {}
    velocity = approach.get("relative_velocity") or {}
    miss = approach.get("miss_distance") or {}
    return {
        "id": neo["id"],
        "name": neo["name"],
        "hazardous": bool(neo.get("is_potentially_hazardous_asteroid", False)),
        "diameter_min_m": _to_float(diameter.get("estimated_diameter_min")),
        "diameter_max_m": _to_float(diameter.get("estimated_diameter_max")),
        "approach_date": approach.get("close_approach_date_full")
        or approach.get("close_approach_date")
        or date_key,
        "miss_distance_km": _to_float(miss.get("kilometers")),
        "miss_distance_lunar": _to_float(miss.get("lunar")),
        "velocity_kps": _to_float(velocity.get("kilometers_per_second")),
    }


class AsteroidService:
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

    async def get_feed(self, start: date | None, end: date | None) -> list[Asteroid]:
        start = start or _today_utc()
        end = end or (start + timedelta(days=MAX_RANGE_DAYS - 1))
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

        cache_key = f"asteroids:{start.isoformat()}:{end.isoformat()}"
        cached = await self._cache.get(cache_key)
        if cached == NEGATIVE_SENTINEL:
            raise self._unavailable()
        if cached is not None:
            return [Asteroid.model_validate(item) for item in cached]

        try:
            raw = await self._request(start, end)
        except httpx.HTTPError as exc:
            await self._cache.set(cache_key, NEGATIVE_SENTINEL, NEGATIVE_CACHE_TTL_SECONDS)
            logger.warning("NeoWs feed fetch failed for %s..%s: %s", start, end, exc)
            raise self._unavailable() from exc

        objects = raw.get("near_earth_objects") or {}
        payload = [_normalise(neo, date_key) for date_key, neos in objects.items() for neo in neos]
        payload.sort(key=lambda item: item["miss_distance_km"])
        await self._cache.set(cache_key, payload, CACHE_TTL_SECONDS)
        return [Asteroid.model_validate(item) for item in payload]

    async def _request(self, start: date, end: date) -> Any:
        return await request_json(
            self._http,
            f"{self._base_url}/neo/rest/v1/feed",
            params={
                "start_date": start.isoformat(),
                "end_date": end.isoformat(),
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
            detail="upstream asteroid data unavailable",
        )
