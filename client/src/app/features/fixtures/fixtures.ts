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

import { map } from 'rxjs';

import { BetSlipService, Selection } from '../../core/services/bet-slip.service';
import { CompetitionGroup, Fixture, FixturesService } from '../../core/services/fixtures.service';
import { COMPETITIONS, Competition, competitionName } from '../../shared/competitions';
import { Crest } from '../../shared/crest/crest';
import { LeagueTabs } from '../../shared/league-tabs/league-tabs';
import { BetSlip } from '../bets/bet-slip/bet-slip';

const GOALS_THRESHOLD = 2.5;
const ALL_ID = 0;

type FixturesState =
  | { kind: 'loading' }
  | { kind: 'loaded'; groups: CompetitionGroup[] }
  | { kind: 'error' };

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
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

  protected readonly sidebar: Competition[] = [
    { id: ALL_ID, name: 'All matches', emblem: '' },
    ...COMPETITIONS,
  ];
  protected readonly selectedLeague = signal<number>(ALL_ID);
  protected readonly selectedDate = signal(todayIso());
  protected readonly state = signal<FixturesState>({ kind: 'loading' });

  protected readonly isToday = computed(() => this.selectedDate() === todayIso());

  protected readonly visibleGroups = computed<CompetitionGroup[]>(() => {
    const current = this.state();
    return current.kind === 'loaded' ? current.groups : [];
  });

  ngOnInit(): void {
    this.load();
  }

  selectLeague(id: number): void {
    if (id !== this.selectedLeague()) {
      this.selectedLeague.set(id);
      this.load();
    }
  }

  shiftDay(delta: number): void {
    this.selectedDate.set(shiftIso(this.selectedDate(), delta));
    this.load();
  }

  goToday(): void {
    if (!this.isToday()) {
      this.selectedDate.set(todayIso());
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
    const date = this.selectedDate();
    const league = this.selectedLeague();

    const source =
      league === ALL_ID
        ? this.fixturesService.listGroupedByDate(date)
        : this.fixturesService.list(league, date).pipe(
            map((fixtures) =>
              fixtures.length
                ? [
                    {
                      competition: { id: league, name: competitionName(league), emblem: '' },
                      fixtures,
                    },
                  ]
                : [],
            ),
          );

    source.subscribe({
      next: (groups) => this.state.set({ kind: 'loaded', groups }),
      error: () => this.state.set({ kind: 'error' }),
    });
  }
}
