from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.followed_mission import FollowedMission


class FollowedMissionRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_for_user(self, user_id: UUID) -> list[FollowedMission]:
        result = await self._db.execute(
            select(FollowedMission)
            .where(FollowedMission.user_id == user_id)
            .order_by(FollowedMission.net.asc())
        )
        return list(result.scalars().all())

    async def get_for_user(self, user_id: UUID, mission_id: int) -> FollowedMission | None:
        result = await self._db.execute(
            select(FollowedMission).where(
                FollowedMission.user_id == user_id,
                FollowedMission.mission_id == mission_id,
            )
        )
        return result.scalar_one_or_none()

    async def add_or_update(
        self,
        user_id: UUID,
        *,
        mission_id: int,
        name: str,
        description: str | None,
        launch_id: str,
        launch_name: str,
        net: datetime,
        provider: str | None,
        image: str | None,
    ) -> FollowedMission:
        followed = await self.get_for_user(user_id, mission_id)
        if followed is None:
            followed = FollowedMission(user_id=user_id, mission_id=mission_id)
            self._db.add(followed)

        followed.name = name
        followed.description = description
        followed.launch_id = launch_id
        followed.launch_name = launch_name
        followed.net = net
        followed.provider = provider
        followed.image = image
        await self._db.commit()
        await self._db.refresh(followed)
        return followed

    async def remove(self, user_id: UUID, mission_id: int) -> None:
        await self._db.execute(
            delete(FollowedMission).where(
                FollowedMission.user_id == user_id,
                FollowedMission.mission_id == mission_id,
            )
        )
        await self._db.commit()
