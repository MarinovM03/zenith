from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import Team


class TeamRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert_many(self, teams: Iterable[tuple[int, str, str | None]]) -> dict[int, Team]:
        teams_list = list(teams)
        api_ids = [api_id for api_id, _, _ in teams_list]

        existing_rows = await self._db.execute(
            select(Team).where(Team.api_football_id.in_(api_ids))
        )
        by_api_id: dict[int, Team] = {t.api_football_id: t for t in existing_rows.scalars()}

        for api_id, name, logo_url in teams_list:
            if api_id in by_api_id:
                by_api_id[api_id].name = name
                by_api_id[api_id].logo_url = logo_url
            else:
                team = Team(api_football_id=api_id, name=name, logo_url=logo_url)
                self._db.add(team)
                by_api_id[api_id] = team

        await self._db.flush()
        return by_api_id
