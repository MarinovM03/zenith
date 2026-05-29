import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';

import { Fixture, FixturesService } from '../../core/services/fixtures.service';

interface League {
  id: number;
  name: string;
}

const LEAGUES: readonly League[] = [
  { id: 2021, name: 'Premier League' },
  { id: 2014, name: 'La Liga' },
  { id: 2019, name: 'Serie A' },
  { id: 2002, name: 'Bundesliga' },
  { id: 2015, name: 'Ligue 1' },
];

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
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Fixtures implements OnInit {
  private readonly fixturesService = inject(FixturesService);

  protected readonly leagues = LEAGUES;
  protected readonly selectedLeague = signal(LEAGUES[0].id);
  protected readonly selectedDate = signal(todayIso());
  protected readonly state = signal<FixturesState>({ kind: 'loading' });

  protected readonly leagueName = computed(
    () => LEAGUES.find((l) => l.id === this.selectedLeague())?.name ?? 'Fixtures',
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

  private load(): void {
    this.state.set({ kind: 'loading' });
    this.fixturesService.list(this.selectedLeague(), this.selectedDate()).subscribe({
      next: (fixtures) => this.state.set({ kind: 'loaded', fixtures }),
      error: () => this.state.set({ kind: 'error' }),
    });
  }
}
