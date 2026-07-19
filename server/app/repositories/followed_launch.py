from datetime import datetime
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.followed_launch import FollowedLaunch


class FollowedLaunchRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_for_user(self, user_id: UUID) -> list[FollowedLaunch]:
        result = await self._db.execute(
            select(FollowedLaunch)
            .where(FollowedLaunch.user_id == user_id)
            .order_by(FollowedLaunch.net.asc())
        )
        return list(result.scalars().all())

    async def get_for_user(self, user_id: UUID, launch_id: str) -> FollowedLaunch | None:
        result = await self._db.execute(
            select(FollowedLaunch).where(
                FollowedLaunch.user_id == user_id,
                FollowedLaunch.launch_id == launch_id,
            )
        )
        return result.scalar_one_or_none()

    async def add_or_update(
        self,
        user_id: UUID,
        *,
        launch_id: str,
        name: str,
        net: datetime,
        status_name: str,
        status_abbrev: str,
        provider: str | None,
        image: str | None,
    ) -> FollowedLaunch:
        followed = await self.get_for_user(user_id, launch_id)
        if followed is None:
            followed = FollowedLaunch(user_id=user_id, launch_id=launch_id)
            self._db.add(followed)

        followed.name = name
        followed.net = net
        followed.status_name = status_name
        followed.status_abbrev = status_abbrev
        followed.provider = provider
        followed.image = image
        await self._db.commit()
        await self._db.refresh(followed)
        return followed

    async def remove(self, user_id: UUID, launch_id: str) -> None:
        await self._db.execute(
            delete(FollowedLaunch).where(
                FollowedLaunch.user_id == user_id,
                FollowedLaunch.launch_id == launch_id,
            )
        )
        await self._db.commit()
