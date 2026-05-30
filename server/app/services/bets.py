from uuid import UUID

from fastapi import HTTPException, status
from pydantic import TypeAdapter
from sqlalchemy.ext.asyncio import AsyncSession

from app.models.bet import Bet, BetLeg
from app.models.fixture import Fixture
from app.repositories.bet import BetRepository
from app.repositories.fixture import FixtureRepository
from app.schemas.bets import CreateBetRequest
from app.services.bet_evaluator import (
    FixtureResult,
    FixtureStatus,
    Leg,
    LegStatus,
    evaluate_bet,
    evaluate_leg,
)

_LEG_ADAPTER: TypeAdapter[Leg] = TypeAdapter(Leg)
_TERMINAL = {"won", "lost", "void"}


def _fixture_result(fixture: Fixture) -> FixtureResult:
    return FixtureResult(
        home_team_id=fixture.home_team_id,
        away_team_id=fixture.away_team_id,
        home_goals=fixture.home_goals,
        away_goals=fixture.away_goals,
        status=FixtureStatus(fixture.status),
    )


def _leg_from_storage(leg: BetLeg) -> Leg:
    return _LEG_ADAPTER.validate_python(
        {"kind": leg.kind, "fixture_id": leg.fixture_id, **leg.params}
    )


def _validate_leg_team(leg: Leg, fixture: Fixture) -> None:
    if leg.kind in ("team_win", "team_loss"):
        team_id = leg.team_id  # type: ignore[union-attr]
        if team_id not in (fixture.home_team_id, fixture.away_team_id):
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="team_id must belong to the fixture",
            )


class BetService:
    def __init__(self, db: AsyncSession) -> None:
        self._db = db
        self._bets = BetRepository(db)
        self._fixtures = FixtureRepository(db)

    async def create_bet(self, *, user_id: UUID, request: CreateBetRequest) -> Bet:
        fixture_ids = [leg.fixture_id for leg in request.legs]
        fixtures = await self._fixtures.get_by_ids(fixture_ids)
        missing = sorted(set(fixture_ids) - set(fixtures))
        if missing:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail=f"unknown fixture id(s): {missing}",
            )

        bet = Bet(user_id=user_id, stake=request.stake, odds=request.odds)
        leg_statuses = []
        for leg in request.legs:
            fixture = fixtures[leg.fixture_id]
            _validate_leg_team(leg, fixture)
            leg_status = evaluate_leg(leg, _fixture_result(fixture))
            leg_statuses.append(leg_status)
            bet.legs.append(
                BetLeg(
                    fixture_id=leg.fixture_id,
                    kind=leg.kind,
                    params=leg.model_dump(mode="json", exclude={"kind", "fixture_id"}),
                    status=leg_status.value,
                )
            )

        bet.status = evaluate_bet(leg_statuses).value
        self._bets.add(bet)
        await self._db.commit()

        reloaded = await self._bets.get_for_user(bet.id, user_id)
        assert reloaded is not None
        return reloaded

    async def list_bets(self, *, user_id: UUID) -> list[Bet]:
        bets = await self._bets.list_for_user(user_id)
        changed = False
        for bet in bets:
            changed = self._reevaluate(bet) or changed
        if changed:
            await self._db.commit()
        return bets

    async def get_bet(self, *, bet_id: UUID, user_id: UUID) -> Bet:
        bet = await self._bets.get_for_user(bet_id, user_id)
        if bet is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="bet not found")
        if self._reevaluate(bet):
            await self._db.commit()
        return bet

    def _reevaluate(self, bet: Bet) -> bool:
        changed = False
        statuses = []
        for leg in bet.legs:
            if leg.status in _TERMINAL:
                statuses.append(LegStatus(leg.status))
                continue
            new_status = evaluate_leg(_leg_from_storage(leg), _fixture_result(leg.fixture))
            if new_status.value != leg.status:
                leg.status = new_status.value
                changed = True
            statuses.append(new_status)

        new_bet_status = evaluate_bet(statuses).value
        if new_bet_status != bet.status:
            bet.status = new_bet_status
            changed = True
        return changed
