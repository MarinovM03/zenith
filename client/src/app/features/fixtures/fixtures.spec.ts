import { provideHttpClient } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Fixtures } from './fixtures';
import { CompetitionGroup, Fixture, FixturesService } from '../../core/services/fixtures.service';

function fixture(id: number, home: string, away: string): Fixture {
  return {
    id,
    external_id: 1000 + id,
    league: { id: 39, name: 'League', country: 'X', logo_url: null },
    home_team: { id: id * 10, name: home, logo_url: null },
    away_team: { id: id * 10 + 1, name: away, logo_url: null },
    kickoff_at: '2026-05-28T15:00:00Z',
    status: 'scheduled',
    home_goals: null,
    away_goals: null,
  };
}

const GROUPS: CompetitionGroup[] = [
  {
    competition: { id: 2021, name: 'Premier League', emblem: '' },
    fixtures: [fixture(1, 'Manchester United', 'Newcastle')],
  },
  {
    competition: { id: 2014, name: 'La Liga', emblem: '' },
    fixtures: [fixture(2, 'Real Madrid', 'Barcelona')],
  },
];

describe('Fixtures', () => {
  function configure(mock: Partial<FixturesService>) {
    TestBed.configureTestingModule({
      imports: [Fixtures],
      providers: [
        provideHttpClient(),
        provideRouter([]),
        { provide: FixturesService, useValue: mock },
      ],
    });
  }

  it('renders grouped matches on success', () => {
    configure({ listGroupedByDate: () => of(GROUPS) });
    const f = TestBed.createComponent(Fixtures);
    f.detectChanges();
    const text = f.nativeElement.textContent;
    expect(text).toContain('Premier League');
    expect(text).toContain('Manchester United');
    expect(text).toContain('La Liga');
    expect(text).toContain('Real Madrid');
  });

  it('shows an empty-state message when there are no matches', () => {
    configure({ listGroupedByDate: () => of([]) });
    const f = TestBed.createComponent(Fixtures);
    f.detectChanges();
    expect(f.nativeElement.textContent).toContain('No matches on this date');
  });

  it('shows an error message on failure', () => {
    configure({ listGroupedByDate: () => throwError(() => new Error('boom')) });
    const f = TestBed.createComponent(Fixtures);
    f.detectChanges();
    expect(f.nativeElement.querySelector('.fixtures__status--error')).toBeTruthy();
  });

  it('fetches a single competition when a league tab is clicked', () => {
    const list = vi.fn().mockReturnValue(of([fixture(2, 'Real Madrid', 'Barcelona')]));
    configure({ listGroupedByDate: () => of(GROUPS), list });
    const f = TestBed.createComponent(Fixtures);
    f.detectChanges();

    // sidebar tabs: [All, Premier League, La Liga, ...] — click La Liga (2014)
    const tabs = f.nativeElement.querySelectorAll('.league-tabs__tab');
    (tabs[2] as HTMLButtonElement).click();
    f.detectChanges();

    expect(list).toHaveBeenCalledWith(2014, expect.any(String));
    expect(f.nativeElement.textContent).toContain('Real Madrid');
  });

  it('reloads when the date changes', () => {
    const listGroupedByDate = vi.fn().mockReturnValue(of(GROUPS));
    configure({ listGroupedByDate });
    const f = TestBed.createComponent(Fixtures);
    f.detectChanges();

    const input: HTMLInputElement = f.nativeElement.querySelector('input[type="date"]');
    input.value = '2025-08-16';
    input.dispatchEvent(new Event('change'));
    f.detectChanges();

    expect(listGroupedByDate).toHaveBeenLastCalledWith('2025-08-16');
  });
});
