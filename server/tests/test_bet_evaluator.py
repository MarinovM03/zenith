import pytest

from app.services.bet_evaluator import (
    BetStatus,
    BttsLeg,
    FixtureResult,
    FixtureStatus,
    LegStatus,
    OverUnderGoalsLeg,
    TeamDrawLeg,
    TeamLossLeg,
    TeamWinLeg,
    evaluate_bet,
    evaluate_leg,
)

HOME = 100
AWAY = 200
OTHER = 999


def finished(home_goals: int, away_goals: int) -> FixtureResult:
    return FixtureResult(
        home_team_id=HOME,
        away_team_id=AWAY,
        home_goals=home_goals,
        away_goals=away_goals,
        status=FixtureStatus.FINISHED,
    )


def in_status(status: FixtureStatus) -> FixtureResult:
    return FixtureResult(
        home_team_id=HOME,
        away_team_id=AWAY,
        home_goals=None,
        away_goals=None,
        status=status,
    )


class TestTeamWin:
    def test_won_when_home_team_wins(self) -> None:
        leg = TeamWinLeg(fixture_id=1, team_id=HOME)
        assert evaluate_leg(leg, finished(2, 1)) == LegStatus.WON

    def test_lost_when_picked_team_loses(self) -> None:
        leg = TeamWinLeg(fixture_id=1, team_id=HOME)
        assert evaluate_leg(leg, finished(0, 3)) == LegStatus.LOST

    def test_lost_on_draw(self) -> None:
        leg = TeamWinLeg(fixture_id=1, team_id=HOME)
        assert evaluate_leg(leg, finished(1, 1)) == LegStatus.LOST


class TestTeamDraw:
    def test_won_on_draw(self) -> None:
        leg = TeamDrawLeg(fixture_id=1)
        assert evaluate_leg(leg, finished(2, 2)) == LegStatus.WON

    def test_lost_when_not_draw(self) -> None:
        leg = TeamDrawLeg(fixture_id=1)
        assert evaluate_leg(leg, finished(1, 0)) == LegStatus.LOST

    def test_won_on_goalless_draw(self) -> None:
        leg = TeamDrawLeg(fixture_id=1)
        assert evaluate_leg(leg, finished(0, 0)) == LegStatus.WON


class TestTeamLoss:
    def test_won_when_picked_team_loses(self) -> None:
        leg = TeamLossLeg(fixture_id=1, team_id=AWAY)
        assert evaluate_leg(leg, finished(3, 1)) == LegStatus.WON

    def test_lost_when_picked_team_wins(self) -> None:
        leg = TeamLossLeg(fixture_id=1, team_id=HOME)
        assert evaluate_leg(leg, finished(2, 0)) == LegStatus.LOST

    def test_lost_on_draw(self) -> None:
        leg = TeamLossLeg(fixture_id=1, team_id=HOME)
        assert evaluate_leg(leg, finished(1, 1)) == LegStatus.LOST


class TestOverUnderGoals:
    def test_over_25_won_with_three_goals(self) -> None:
        leg = OverUnderGoalsLeg(fixture_id=1, threshold=2.5, direction="over")
        assert evaluate_leg(leg, finished(2, 1)) == LegStatus.WON

    def test_over_25_lost_with_two_goals(self) -> None:
        leg = OverUnderGoalsLeg(fixture_id=1, threshold=2.5, direction="over")
        assert evaluate_leg(leg, finished(1, 1)) == LegStatus.LOST

    def test_under_25_won_with_two_goals(self) -> None:
        leg = OverUnderGoalsLeg(fixture_id=1, threshold=2.5, direction="under")
        assert evaluate_leg(leg, finished(1, 1)) == LegStatus.WON

    def test_under_25_lost_with_three_goals(self) -> None:
        leg = OverUnderGoalsLeg(fixture_id=1, threshold=2.5, direction="under")
        assert evaluate_leg(leg, finished(2, 1)) == LegStatus.LOST

    def test_over_at_integer_threshold_is_strict(self) -> None:
        leg = OverUnderGoalsLeg(fixture_id=1, threshold=3.0, direction="over")
        assert evaluate_leg(leg, finished(2, 1)) == LegStatus.LOST


class TestBtts:
    def test_yes_won_when_both_score(self) -> None:
        leg = BttsLeg(fixture_id=1, expected=True)
        assert evaluate_leg(leg, finished(1, 2)) == LegStatus.WON

    def test_yes_lost_when_clean_sheet(self) -> None:
        leg = BttsLeg(fixture_id=1, expected=True)
        assert evaluate_leg(leg, finished(3, 0)) == LegStatus.LOST

    def test_no_won_when_clean_sheet(self) -> None:
        leg = BttsLeg(fixture_id=1, expected=False)
        assert evaluate_leg(leg, finished(2, 0)) == LegStatus.WON

    def test_no_lost_when_both_score(self) -> None:
        leg = BttsLeg(fixture_id=1, expected=False)
        assert evaluate_leg(leg, finished(1, 1)) == LegStatus.LOST


class TestFixtureLifecycle:
    @pytest.mark.parametrize(
        "status",
        [FixtureStatus.SCHEDULED, FixtureStatus.LIVE],
    )
    def test_pending_before_fixture_finishes(self, status: FixtureStatus) -> None:
        leg = TeamWinLeg(fixture_id=1, team_id=HOME)
        assert evaluate_leg(leg, in_status(status)) == LegStatus.PENDING

    @pytest.mark.parametrize(
        "status",
        [FixtureStatus.POSTPONED, FixtureStatus.CANCELLED],
    )
    def test_void_when_fixture_does_not_happen(self, status: FixtureStatus) -> None:
        leg = BttsLeg(fixture_id=1, expected=True)
        assert evaluate_leg(leg, in_status(status)) == LegStatus.VOID

    def test_void_when_finished_but_goals_missing(self) -> None:
        leg = TeamDrawLeg(fixture_id=1)
        broken = FixtureResult(
            home_team_id=HOME,
            away_team_id=AWAY,
            home_goals=None,
            away_goals=None,
            status=FixtureStatus.FINISHED,
        )
        assert evaluate_leg(leg, broken) == LegStatus.VOID


class TestEvaluateBet:
    def test_empty_is_pending(self) -> None:
        assert evaluate_bet([]) == BetStatus.PENDING

    def test_all_won(self) -> None:
        assert evaluate_bet([LegStatus.WON, LegStatus.WON]) == BetStatus.WON

    def test_one_pending_remaining_won(self) -> None:
        assert evaluate_bet([LegStatus.WON, LegStatus.PENDING]) == BetStatus.PENDING

    def test_one_lost_overrides_everything(self) -> None:
        assert evaluate_bet([LegStatus.WON, LegStatus.LOST, LegStatus.PENDING]) == BetStatus.LOST

    def test_all_void(self) -> None:
        assert evaluate_bet([LegStatus.VOID, LegStatus.VOID]) == BetStatus.VOID

    def test_mixed_won_and_void_is_won(self) -> None:
        assert evaluate_bet([LegStatus.WON, LegStatus.VOID]) == BetStatus.WON

    def test_pending_beats_void(self) -> None:
        assert evaluate_bet([LegStatus.VOID, LegStatus.PENDING]) == BetStatus.PENDING
