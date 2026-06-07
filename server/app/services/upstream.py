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
    retry_on_404: bool = False,
) -> Any:
    """GET a JSON endpoint, retrying transient failures (timeouts, 5xx).
    Client errors such as 404 are raised immediately, unless retry_on_404 is set
    (some upstreams flakily 404 a resource that does exist)."""
    last_exc: httpx.HTTPError | None = None
    # Connections to these upstreams are always quick; it's the response that
    # can be slow (NASA's CDN serves a cold page from origin in 15-20s). So cap
    # the connect timeout short and spend the budget on the read.
    timeout = httpx.Timeout(timeout_seconds, connect=min(timeout_seconds, 5.0))
    for attempt in range(retries + 1):
        try:
            response = await http.get(url, params=params, timeout=timeout)
            response.raise_for_status()
            return response.json()
        except httpx.HTTPStatusError as exc:
            status_code = exc.response.status_code
            retryable = status_code >= 500 or (retry_on_404 and status_code == 404)
            if not retryable:
                raise
            last_exc = exc
        except httpx.HTTPError as exc:
            last_exc = exc
        if attempt < retries:
            await asyncio.sleep(backoff_seconds * (attempt + 1))
    assert last_exc is not None
    raise last_exc
