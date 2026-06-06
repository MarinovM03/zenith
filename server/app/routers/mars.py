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
        base_url=settings.mars_base_url,
    )


ServiceDep = Annotated[MarsPhotoService, Depends(get_mars_service)]

router = APIRouter(prefix="/mars", tags=["mars"])


@router.get("/photos", response_model=list[MarsPhoto])
async def get_mars_photos(
    service: ServiceDep,
    page: Annotated[int, Query(ge=1, le=100)] = 1,
) -> list[MarsPhoto]:
    return await service.get_photos(page)
