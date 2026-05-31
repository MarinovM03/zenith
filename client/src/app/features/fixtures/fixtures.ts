import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { RouterLink } from '@angular/router';

import { BetSlipService, Selection } from '../../core/services/bet-slip.service';
import { Fixture, FixturesService } from '../../core/services/fixtures.service';
import { COMPETITIONS } from '../../shared/competitions';
import { Crest } from '../../shared/crest/crest';
import { LeagueTabs } from '../../shared/league-tabs/league-tabs';
import { BetSlip } from '../bets/bet-slip/bet-slip';

const GOALS_THRESHOLD = 2.5;

type FixturesState =
  | { kind: 'loading' }
  | { kind: 'loaded'; fixtures: Fixture[] }
  | { kind: 'error' };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

@Component({
  selector: 'app-fixtures',
  templateUrl: './fixtures.html',
  styleUrl: './fixtures.css',
  imports: [DatePipe, BetSlip, Crest, LeagueTabs, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fixtures implements OnInit {
  private readonly fixturesService = inject(FixturesService);
  protected readonly slip = inject(BetSlipService);

  protected readonly leagues = COMPETITIONS;
  protected readonly selectedLeague = signal(COMPETITIONS[0].id);
  protected readonly selectedDate = signal(todayIso());
  protected readonly state = signal<FixturesState>({ kind: 'loading' });

  protected readonly leagueName = computed(
    () => COMPETITIONS.find((l) => l.id === this.selectedLeague())?.name ?? 'Fixtures',
  );

  ngOnInit(): void {
    this.load();
  }

  selectLeague(id: number): void {
    if (id !== this.selectedLeague()) {
      this.selectedLeague.set(id);
      this.load();
    }
  }

  onDateChange(event: Event): void {
    const value = (event.target as HTMLInputElement).value;
    if (value) {
      this.selectedDate.set(value);
      this.load();
    }
  }

  chips(fixture: Fixture): Selection[] {
    const match = `${fixture.home_team.name} v ${fixture.away_team.name}`;
    const build = (key: string, label: string, leg: Selection['leg']): Selection => ({
      key: `${fixture.id}:${key}`,
      fixtureId: fixture.id,
      matchLabel: match,
      label,
      leg,
    });
    return [
      build('1', fixture.home_team.name, {
        kind: 'team_win',
        fixture_id: fixture.id,
        team_id: fixture.home_team.id,
      }),
      build('x', 'Draw', { kind: 'team_draw', fixture_id: fixture.id }),
      build('2', fixture.away_team.name, {
        kind: 'team_win',
        fixture_id: fixture.id,
        team_id: fixture.away_team.id,
      }),
      build('over', 'Over 2.5', {
        kind: 'over_under_goals',
        fixture_id: fixture.id,
        threshold: GOALS_THRESHOLD,
        direction: 'over',
      }),
      build('under', 'Under 2.5', {
        kind: 'over_under_goals',
        fixture_id: fixture.id,
        threshold: GOALS_THRESHOLD,
        direction: 'under',
      }),
      build('btts', 'BTTS', { kind: 'btts', fixture_id: fixture.id, expected: true }),
      build('nobtts', 'No BTTS', { kind: 'btts', fixture_id: fixture.id, expected: false }),
    ];
  }

  private load(): void {
    this.state.set({ kind: 'loading' });
    this.fixturesService.list(this.selectedLeague(), this.selectedDate()).subscribe({
      next: (fixtures) => this.state.set({ kind: 'loaded', fixtures }),
      error: () => this.state.set({ kind: 'error' }),
    });
  }
}
