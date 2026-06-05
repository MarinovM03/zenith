from typing import Annotated

from fastapi import APIRouter, Depends, Query

from app.core.config import get_settings
from app.db.redis import get_redis
from app.schemas.launch import Launch
from app.services.cache import JsonCache
from app.services.http_client import get_shared_http_client
from app.services.launch import LaunchService


def get_launch_service() -> LaunchService:
    settings = get_settings()
    return LaunchService(
        http=get_shared_http_client(),
        cache=JsonCache(get_redis()),
        base_url=settings.launch_library_base_url,
    )


ServiceDep = Annotated[LaunchService, Depends(get_launch_service)]
LimitDep = Annotated[int, Query(ge=1, le=50)]

router = APIRouter(prefix="/launches", tags=["launches"])


@router.get("/upcoming", response_model=list[Launch])
async def get_upcoming(service: ServiceDep, limit: LimitDep = 10) -> list[Launch]:
    return await service.get_upcoming(limit)


@router.get("/previous", response_model=list[Launch])
async def get_previous(service: ServiceDep, limit: LimitDep = 10) -> list[Launch]:
    return await service.get_previous(limit)


@router.get("/{launch_id}", response_model=Launch)
async def get_launch(service: ServiceDep, launch_id: str) -> Launch:
    return await service.get_detail(launch_id)
