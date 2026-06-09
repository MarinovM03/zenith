from typing import Annotated

from fastapi import APIRouter, Depends

from app.core.config import get_settings
from app.db.redis import get_redis
from app.schemas.iss import IssPosition
from app.services.cache import JsonCache
from app.services.http_client import get_shared_http_client
from app.services.iss import IssService


def get_iss_service() -> IssService:
    settings = get_settings()
    return IssService(
        http=get_shared_http_client(),
        cache=JsonCache(get_redis()),
        base_url=settings.iss_base_url,
    )


ServiceDep = Annotated[IssService, Depends(get_iss_service)]

router = APIRouter(prefix="/iss", tags=["iss"])


@router.get("", response_model=IssPosition)
async def get_iss_position(service: ServiceDep) -> IssPosition:
    return await service.get_position()
