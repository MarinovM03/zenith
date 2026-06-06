import asyncio
from collections.abc import Mapping
from typing import Any

import httpx

NEGATIVE_SENTINEL = {"__missing__": True}

DEFAULT_RETRIES = 2
DEFAULT_BACKOFF_SECONDS = 0.5
DEFAULT_TIMEOUT_SECONDS = 10.0


async def request_json(
    http: httpx.AsyncClient,
    url: str,
    *,
    params: Mapping[str, Any] | None = None,
    retries: int = DEFAULT_RETRIES,
    backoff_seconds: float = DEFAULT_BACKOFF_SECONDS,
    timeout_seconds: float = DEFAULT_TIMEOUT_SECONDS,
) -> Any:
    """GET a JSON endpoint, retrying transient failures (timeouts, 5xx).
    Client errors such as 404 are raised immediately — retrying won't help."""
    last_exc: httpx.HTTPError | None = None
    for attempt in range(retries + 1):
        try:
            response = await http.get(url, params=params, timeout=timeout_seconds)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code < 500:
                raise
            last_exc = exc
        except httpx.HTTPError as exc:
            last_exc = exc
        if attempt < retries:
            await asyncio.sleep(backoff_seconds * (attempt + 1))
    assert last_exc is not None
    raise last_exc
