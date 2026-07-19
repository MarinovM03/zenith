from uuid import UUID

from app.models.followed_launch import FollowedLaunch
from app.repositories.followed_launch import FollowedLaunchRepository
from app.services.launch import LaunchService


class FollowedLaunchService:
    def __init__(self, repository: FollowedLaunchRepository, launch_service: LaunchService) -> None:
        self._repository = repository
        self._launch_service = launch_service

    async def list_for_user(self, user_id: UUID) -> list[FollowedLaunch]:
        return await self._repository.list_for_user(user_id)

    async def follow(self, user_id: UUID, launch_id: str) -> FollowedLaunch:
        launch = await self._launch_service.get_detail(launch_id)
        return await self._repository.add_or_update(
            user_id,
            launch_id=launch.id,
            name=launch.name,
            net=launch.net,
            status_name=launch.status.name,
            status_abbrev=launch.status.abbrev,
            provider=launch.provider,
            image=launch.image,
        )

    async def unfollow(self, user_id: UUID, launch_id: str) -> None:
        await self._repository.remove(user_id, launch_id)
