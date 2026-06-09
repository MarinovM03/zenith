import httpx

_shared_http_client: httpx.AsyncClient | None = None


def get_shared_http_client() -> httpx.AsyncClient:
    """A single app-wide HTTP client so outbound connections are pooled and
    kept alive instead of doing a fresh TLS handshake on every request."""
    global _shared_http_client
    if _shared_http_client is None:
        _shared_http_client = httpx.AsyncClient(
            timeout=httpx.Timeout(15.0),
            limits=httpx.Limits(
                max_connections=20, max_keepalive_connections=10, keepalive_expiry=60.0
            ),
        )
    return _shared_http_client


async def close_shared_http_client() -> None:
    global _shared_http_client
    if _shared_http_client is not None:
        await _shared_http_client.aclose()
        _shared_http_client = None
