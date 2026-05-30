from collections.abc import AsyncIterator
from datetime import UTC, datetime

import pytest
import pytest_asyncio
from httpx import AsyncClient
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.fixture import Fixture
from app.models.league import League
from app.models.team import Team

EMAIL = "martin@example.com"
PASSWORD = "correct-horse-battery-staple"


async def _seed_fixture(
    db: AsyncSession,
    *,
    external_id: int = 1,
    status: str = "finished",
    home_goals: int | None = 2,
    away_goals: int | None = 1,
    home_external: int = 57,
    away_external: int = 61,
) -> tuple[int, int, int]:
    league = League(
        external_id=2021 + external_id, name="Premier League", country="England", logo_url=None
    )
    home = Team(external_id=home_external, name="Arsenal FC", logo_url=None)
    away = Team(external_id=away_external, name="Chelsea FC", logo_url=None)
    db.add_all([league, home, away])
    await db.flush()

    fixture = Fixture(
        external_id=external_id,
        league_id=league.id,
        home_team_id=home.id,
        away_team_id=away.id,
        kickoff_at=datetime(2025, 8, 16, 14, 0, tzinfo=UTC),
        status=status,
        home_goals=home_goals,
        away_goals=away_goals,
    )
    db.add(fixture)
    await db.commit()
    return fixture.id, home.id, away.id


@pytest_asyncio.fixture
async def auth_client(client: AsyncClient) -> AsyncIterator[AsyncClient]:
    await client.post("/auth/register", json={"email": EMAIL, "password": PASSWORD})
    login = await client.post("/auth/login", json={"email": EMAIL, "password": PASSWORD})
    client.headers["Authorization"] = f"Bearer {login.json()['access_token']}"
    yield client


class TestCreateBet:
    @pytest.mark.asyncio
    async def test_single_leg_resolves_won(
        self, auth_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        fixture_id, home_id, _ = await _seed_fixture(db_session)
        response = await auth_client.post(
            "/bets",
            json={
                "stake": "10.00",
                "odds": "2.50",
                "legs": [{"kind": "team_win", "fixture_id": fixture_id, "team_id": home_id}],
            },
        )
        assert response.status_code == 201, response.text
        body = response.json()
        assert body["status"] == "won"
        assert body["legs"][0]["status"] == "won"
        assert body["potential_return"] == "25.00"

    @pytest.mark.asyncio
    async def test_single_leg_resolves_lost(
        self, auth_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        fixture_id, _, away_id = await _seed_fixture(db_session)
        response = await auth_client.post(
            "/bets",
            json={"legs": [{"kind": "team_win", "fixture_id": fixture_id, "team_id": away_id}]},
        )
        assert response.status_code == 201
        assert response.json()["status"] == "lost"

    @pytest.mark.asyncio
    async def test_accumulator_lost_when_one_leg_lost(
        self, auth_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        fixture_id, home_id, away_id = await _seed_fixture(db_session)
        response = await auth_client.post(
            "/bets",
            json={
                "legs": [
                    {"kind": "team_win", "fixture_id": fixture_id, "team_id": home_id},
                    {"kind": "team_win", "fixture_id": fixture_id, "team_id": away_id},
                ]
            },
        )
        assert response.status_code == 201
        assert response.json()["status"] == "lost"

    @pytest.mark.asyncio
    async def test_btts_and_over_under(
        self, auth_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        fixture_id, _, _ = await _seed_fixture(db_session, home_goals=2, away_goals=1)
        response = await auth_client.post(
            "/bets",
            json={
                "legs": [
                    {"kind": "btts", "fixture_id": fixture_id, "expected": True},
                    {
                        "kind": "over_under_goals",
                        "fixture_id": fixture_id,
                        "threshold": 2.5,
                        "direction": "over",
                    },
                ]
            },
        )
        assert response.status_code == 201
        assert response.json()["status"] == "won"

    @pytest.mark.asyncio
    async def test_pending_for_scheduled_fixture(
        self, auth_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        fixture_id, home_id, _ = await _seed_fixture(
            db_session, status="scheduled", home_goals=None, away_goals=None
        )
        response = await auth_client.post(
            "/bets",
            json={"legs": [{"kind": "team_win", "fixture_id": fixture_id, "team_id": home_id}]},
        )
        assert response.status_code == 201
        assert response.json()["status"] == "pending"

    @pytest.mark.asyncio
    async def test_unknown_fixture_returns_422(self, auth_client: AsyncClient) -> None:
        response = await auth_client.post(
            "/bets",
            json={"legs": [{"kind": "team_win", "fixture_id": 99999, "team_id": 1}]},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_team_not_in_fixture_returns_422(
        self, auth_client: AsyncClient, db_session: AsyncSession
    ) -> None:
        fixture_id, _, _ = await _seed_fixture(db_session)
        response = await auth_client.post(
            "/bets",
            json={"legs": [{"kind": "team_win", "fixture_id": fixture_id, "team_id": 999}]},
        )
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_empty_legs_returns_422(self, auth_client: AsyncClient) -> None:
        response = await auth_client.post("/bets", json={"legs": []})
        assert response.status_code == 422

    @pytest.mark.asyncio
    async def test_requires_authentication(self, client: AsyncClient) -> None:
        response = await client.post(
            "/bets", json={"legs": [{"kind": "team_draw", "fixture_id": 1}]}
        )
        assert response.status_code == 401


class TestListAndGet:
    @pytest.mark.asyncio
    async def test_lists_own_bets(self, auth_client: AsyncClient, db_session: AsyncSession) -> None:
        fixture_id, home_id, _ = await _seed_fixture(db_session)
        await auth_client.post(
            "/bets",
            json={"legs": [{"kind": "team_win", "fixture_id": fixture_id, "team_id": home_id}]},
        )
        response = await auth_client.get("/bets")
        assert response.status_code == 200
        assert len(response.json()) == 1

    @pytest.mark.asyncio
    async def test_does_not_leak_other_users_bets(
        self, auth_client: AsyncClient, client: AsyncClient, db_session: AsyncSession
    ) -> None:
        fixture_id, home_id, _ = await _seed_fixture(db_session)
        await auth_client.post(
            "/bets",
            json={"legs": [{"kind": "team_win", "fixture_id": fixture_id, "team_id": home_id}]},
        )

        await client.post(
            "/auth/register", json={"email": "other@example.com", "password": PASSWORD}
        )
        other_login = await client.post(
            "/auth/login", json={"email": "other@example.com", "password": PASSWORD}
        )
        other_token = other_login.json()["access_token"]
        response = await client.get("/bets", headers={"Authorization": f"Bearer {other_token}"})
        assert response.status_code == 200
        assert response.json() == []

    @pytest.mark.asyncio
    async def test_get_unknown_bet_returns_404(self, auth_client: AsyncClient) -> None:
        response = await auth_client.get("/bets/00000000-0000-0000-0000-000000000000")
        assert response.status_code == 404
