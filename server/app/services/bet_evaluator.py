from collections.abc import Callable, Iterable
from enum import Enum
from typing import Annotated, Literal

from pydantic import BaseModel, Field


class LegStatus(str, Enum):
    PENDING = "pending"
    WON = "won"
    LOST = "lost"
    VOID = "void"


class BetStatus(str, Enum):
    PENDING = "pending"
    WON = "won"
    LOST = "lost"
    VOID = "void"


class FixtureStatus(str, Enum):
    SCHEDULED = "scheduled"
    LIVE = "live"
    FINISHED = "finished"
    POSTPONED = "postponed"
    CANCELLED = "cancelled"


class FixtureResult(BaseModel):
    home_team_id: int
    away_team_id: int
    home_goals: int | None = None
    away_goals: int | None = None
    status: FixtureStatus


class TeamWinLeg(BaseModel):
    kind: Literal["team_win"] = "team_win"
    fixture_id: int
    team_id: int


class TeamDrawLeg(BaseModel):
    kind: Literal["team_draw"] = "team_draw"
    fixture_id: int


class TeamLossLeg(BaseModel):
    kind: Literal["team_loss"] = "team_loss"
    fixture_id: int
    team_id: int


class OverUnderGoalsLeg(BaseModel):
    kind: Literal["over_under_goals"] = "over_under_goals"
    fixture_id: int
    threshold: float
    direction: Literal["over", "under"]


class BttsLeg(BaseModel):
    kind: Literal["btts"] = "btts"
    fixture_id: int
    expected: bool


type Leg = Annotated[
    TeamWinLeg | TeamDrawLeg | TeamLossLeg | OverUnderGoalsLeg | BttsLeg,
    Field(discriminator="kind"),
]


type LegEvaluator = Callable[[BaseModel, FixtureResult], LegStatus]
_REGISTRY: dict[str, LegEvaluator] = {}


def _register(kind: str) -> Callable[[LegEvaluator], LegEvaluator]:
    def decorator(fn: LegEvaluator) -> LegEvaluator:
        if kind in _REGISTRY:
            raise ValueError(f"Evaluator for leg kind '{kind}' already registered")
        _REGISTRY[kind] = fn
        return fn

    return decorator


def _pre_evaluation_status(fixture: FixtureResult) -> LegStatus | None:
    if fixture.status in (FixtureStatus.SCHEDULED, FixtureStatus.LIVE):
        return LegStatus.PENDING
    if fixture.status in (FixtureStatus.POSTPONED, FixtureStatus.CANCELLED):
        return LegStatus.VOID
    if fixture.home_goals is None or fixture.away_goals is None:
        return LegStatus.VOID
    return None


@_register("team_win")
def _eval_team_win(leg: TeamWinLeg, fixture: FixtureResult) -> LegStatus:
    if (pre := _pre_evaluation_status(fixture)) is not None:
        return pre
    assert fixture.home_goals is not None and fixture.away_goals is not None
    if fixture.home_goals > fixture.away_goals:
        won = leg.team_id == fixture.home_team_id
    elif fixture.away_goals > fixture.home_goals:
        won = leg.team_id == fixture.away_team_id
    else:
        won = False
    return LegStatus.WON if won else LegStatus.LOST


@_register("team_draw")
def _eval_team_draw(leg: TeamDrawLeg, fixture: FixtureResult) -> LegStatus:
    if (pre := _pre_evaluation_status(fixture)) is not None:
        return pre
    assert fixture.home_goals is not None and fixture.away_goals is not None
    return LegStatus.WON if fixture.home_goals == fixture.away_goals else LegStatus.LOST


@_register("team_loss")
def _eval_team_loss(leg: TeamLossLeg, fixture: FixtureResult) -> LegStatus:
    if (pre := _pre_evaluation_status(fixture)) is not None:
        return pre
    assert fixture.home_goals is not None and fixture.away_goals is not None
    if fixture.home_goals > fixture.away_goals:
        losing_team_id: int | None = fixture.away_team_id
    elif fixture.away_goals > fixture.home_goals:
        losing_team_id = fixture.home_team_id
    else:
        losing_team_id = None
    return LegStatus.WON if leg.team_id == losing_team_id else LegStatus.LOST


@_register("over_under_goals")
def _eval_over_under_goals(leg: OverUnderGoalsLeg, fixture: FixtureResult) -> LegStatus:
    if (pre := _pre_evaluation_status(fixture)) is not None:
        return pre
    assert fixture.home_goals is not None and fixture.away_goals is not None
    total = fixture.home_goals + fixture.away_goals
    won = total > leg.threshold if leg.direction == "over" else total < leg.threshold
    return LegStatus.WON if won else LegStatus.LOST


@_register("btts")
def _eval_btts(leg: BttsLeg, fixture: FixtureResult) -> LegStatus:
    if (pre := _pre_evaluation_status(fixture)) is not None:
        return pre
    assert fixture.home_goals is not None and fixture.away_goals is not None
    both_scored = fixture.home_goals > 0 and fixture.away_goals > 0
    return LegStatus.WON if both_scored == leg.expected else LegStatus.LOST


def evaluate_leg(leg: Leg, fixture: FixtureResult) -> LegStatus:
    return _REGISTRY[leg.kind](leg, fixture)


def evaluate_bet(leg_statuses: Iterable[LegStatus]) -> BetStatus:
    statuses = list(leg_statuses)
    if not statuses:
        return BetStatus.PENDING
    if any(s == LegStatus.LOST for s in statuses):
        return BetStatus.LOST
    if any(s == LegStatus.PENDING for s in statuses):
        return BetStatus.PENDING
    if all(s == LegStatus.VOID for s in statuses):
        return BetStatus.VOID
    return BetStatus.WON
