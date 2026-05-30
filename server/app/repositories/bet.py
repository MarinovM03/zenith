from uuid import UUID

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bet import Bet


class BetRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    def add(self, bet: Bet) -> None:
        self._db.add(bet)

    async def list_for_user(self, user_id: UUID) -> list[Bet]:
        result = await self._db.execute(
            select(Bet).where(Bet.user_id == user_id).order_by(Bet.created_at.desc())
        )
        return list(result.scalars())

    async def get_for_user(self, bet_id: UUID, user_id: UUID) -> Bet | None:
        result = await self._db.execute(
            select(Bet).where(Bet.id == bet_id).where(Bet.user_id == user_id)
        )
        return result.scalar_one_or_none()
