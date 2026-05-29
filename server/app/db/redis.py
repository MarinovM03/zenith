from redis.asyncio import Redis

from app.core.config import get_settings


def create_redis() -> Redis:
    return Redis.from_url(get_settings().redis_url, decode_responses=True)


_redis: Redis | None = None


def get_redis() -> Redis:
    global _redis
    if _redis is None:
        _redis = create_redis()
    return _redis
