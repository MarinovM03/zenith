from typing import Any
from uuid import UUID

from sqlalchemy import delete, select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.favourite import Favourite


class FavouriteRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def list_for_user(self, user_id: UUID) -> list[Favourite]:
        result = await self._db.execute(
            select(Favourite)
            .where(Favourite.user_id == user_id)
            .order_by(Favourite.created_at.desc())
        )
        return list(result.scalars().all())

    async def add(
        self, user_id: UUID, kind: str, ref_id: str, payload: dict[str, Any]
    ) -> Favourite:
        existing = await self._get(user_id, kind, ref_id)
        if existing is not None:
            existing.payload = payload
            await self._db.commit()
            await self._db.refresh(existing)
            return existing

        favourite = Favourite(user_id=user_id, kind=kind, ref_id=ref_id, payload=payload)
        self._db.add(favourite)
        await self._db.commit()
        await self._db.refresh(favourite)
        return favourite

    async def remove(self, user_id: UUID, kind: str, ref_id: str) -> None:
        await self._db.execute(
            delete(Favourite).where(
                Favourite.user_id == user_id,
                Favourite.kind == kind,
                Favourite.ref_id == ref_id,
            )
        )
        await self._db.commit()

    async def _get(self, user_id: UUID, kind: str, ref_id: str) -> Favourite | None:
        result = await self._db.execute(
            select(Favourite).where(
                Favourite.user_id == user_id,
                Favourite.kind == kind,
                Favourite.ref_id == ref_id,
            )
        )
        return result.scalar_one_or_none()
