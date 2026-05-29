from collections.abc import Iterable

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.team import Team


class TeamRepository:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db

    async def upsert_many(self, teams: Iterable[tuple[int, str, str | None]]) -> dict[int, Team]:
        teams_list = list(teams)
        external_ids = [external_id for external_id, _, _ in teams_list]

        existing_rows = await self._db.execute(
            select(Team).where(Team.external_id.in_(external_ids))
        )
        by_external_id: dict[int, Team] = {t.external_id: t for t in existing_rows.scalars()}

        for external_id, name, logo_url in teams_list:
            if external_id in by_external_id:
                by_external_id[external_id].name = name
                by_external_id[external_id].logo_url = logo_url
            else:
                team = Team(external_id=external_id, name=name, logo_url=logo_url)
                self._db.add(team)
                by_external_id[external_id] = team

        await self._db.flush()
        return by_external_id
