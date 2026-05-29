from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.league import League


class LeagueRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def get_by_api_id(self, api_id: int) -> League | None:
        result = await self._db.execute(select(League).where(League.api_football_id == api_id))
        return result.scalar_one_or_none()

    async def upsert(self, *, api_id: int, name: str, country: str, logo_url: str | None) -> League:
        existing = await self.get_by_api_id(api_id)
        if existing is not None:
            existing.name = name
            existing.country = country
            existing.logo_url = logo_url
            await self._db.flush()
            return existing
        league = League(api_football_id=api_id, name=name, country=country, logo_url=logo_url)
        self._db.add(league)
        await self._db.flush()
        return league
