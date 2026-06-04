from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.config import get_settings
from app.db.redis import get_redis
from app.schemas.apod import Apod
from app.services.apod import NasaApodService
from app.services.cache import JsonCache
from app.services.http_client import get_shared_http_client


def get_apod_service() -> NasaApodService:
    settings = get_settings()
    return NasaApodService(
        http=get_shared_http_client(),
        cache=JsonCache(get_redis()),
        api_key=settings.nasa_api_key,
        base_url=settings.nasa_base_url,
    )


ServiceDep = Annotated[NasaApodService, Depends(get_apod_service)]

router = APIRouter(prefix="/apod", tags=["apod"])


@router.get("", response_model=Apod)
async def get_apod(
    service: ServiceDep,
    day: Annotated[date | None, Query(alias="date")] = None,
) -> Apod:
    return await service.get(day)


@router.get("/range", response_model=list[Apod])
async def get_apod_range(
    service: ServiceDep,
    start: Annotated[date, Query()],
    end: Annotated[date, Query()],
) -> list[Apod]:
    return await service.get_range(start, end)
