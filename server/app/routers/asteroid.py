from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.config import get_settings
from app.db.redis import get_redis
from app.schemas.asteroid import Asteroid
from app.services.asteroid import AsteroidService
from app.services.cache import JsonCache
from app.services.http_client import get_shared_http_client


def get_asteroid_service() -> AsteroidService:
    settings = get_settings()
    return AsteroidService(
        http=get_shared_http_client(),
        cache=JsonCache(get_redis()),
        api_key=settings.nasa_api_key,
        base_url=settings.nasa_base_url,
    )


ServiceDep = Annotated[AsteroidService, Depends(get_asteroid_service)]

router = APIRouter(prefix="/asteroids", tags=["asteroids"])


@router.get("", response_model=list[Asteroid])
async def get_asteroids(
    service: ServiceDep,
    start: Annotated[date | None, Query()] = None,
    end: Annotated[date | None, Query()] = None,
) -> list[Asteroid]:
    return await service.get_feed(start, end)
