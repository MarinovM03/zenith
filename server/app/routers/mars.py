from datetime import date
from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.config import get_settings
from app.db.redis import get_redis
from app.schemas.mars import MarsPhoto
from app.services.cache import JsonCache
from app.services.http_client import get_shared_http_client
from app.services.mars import MarsPhotoService


def get_mars_service() -> MarsPhotoService:
    settings = get_settings()
    return MarsPhotoService(
        http=get_shared_http_client(),
        cache=JsonCache(get_redis()),
        api_key=settings.nasa_api_key,
        base_url=settings.nasa_base_url,
    )


ServiceDep = Annotated[MarsPhotoService, Depends(get_mars_service)]

router = APIRouter(prefix="/mars", tags=["mars"])


@router.get("/photos", response_model=list[MarsPhoto])
async def get_mars_photos(
    service: ServiceDep,
    day: Annotated[date, Query(alias="date")],
    rover: Annotated[str, Query()] = "curiosity",
    page: Annotated[int, Query(ge=1, le=50)] = 1,
) -> list[MarsPhoto]:
    return await service.get_photos(rover, day, page)
