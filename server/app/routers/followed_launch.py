from typing import Annotated

from fastapi import APIRouter, Depends, Path, status
from sqlalchemy.ext.asyncio import AsyncSession

from app.db.session import get_db
from app.models.followed_launch import FollowedLaunch
from app.models.user import User
from app.repositories.followed_launch import FollowedLaunchRepository
from app.routers.launch import get_launch_service
from app.schemas.followed_launch import FollowedLaunchResponse
from app.services.auth import get_current_user
from app.services.followed_launch import FollowedLaunchService
from app.services.launch import LaunchService

DbDep = Annotated[AsyncSession, Depends(get_db)]
LaunchServiceDep = Annotated[LaunchService, Depends(get_launch_service)]
CurrentUserDep = Annotated[User, Depends(get_current_user)]
LaunchIdDep = Annotated[str, Path(min_length=1, max_length=200)]


def get_followed_launch_service(
    db: DbDep, launch_service: LaunchServiceDep
) -> FollowedLaunchService:
    return FollowedLaunchService(FollowedLaunchRepository(db), launch_service)


ServiceDep = Annotated[FollowedLaunchService, Depends(get_followed_launch_service)]

router = APIRouter(prefix="/followed-launches", tags=["followed launches"])


@router.get("", response_model=list[FollowedLaunchResponse])
async def list_followed_launches(
    current_user: CurrentUserDep, service: ServiceDep
) -> list[FollowedLaunch]:
    return await service.list_for_user(current_user.id)


@router.put("/{launch_id}", response_model=FollowedLaunchResponse)
async def follow_launch(
    launch_id: LaunchIdDep, current_user: CurrentUserDep, service: ServiceDep
) -> FollowedLaunch:
    return await service.follow(current_user.id, launch_id)


@router.delete("/{launch_id}", status_code=status.HTTP_204_NO_CONTENT)
async def unfollow_launch(
    launch_id: LaunchIdDep, current_user: CurrentUserDep, service: ServiceDep
) -> None:
    await service.unfollow(current_user.id, launch_id)
