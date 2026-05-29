import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';
import { vi } from 'vitest';

import { Fixtures } from './fixtures';
import { Fixture, FixturesService } from '../../core/services/fixtures.service';

const FAKE_FIXTURE: Fixture = {
  id: 1,
  external_id: 1001,
  league: { id: 39, name: 'Premier League', country: 'England', logo_url: null },
  home_team: { id: 33, name: 'Manchester United', logo_url: null },
  away_team: { id: 34, name: 'Newcastle', logo_url: null },
  kickoff_at: '2026-05-28T15:00:00Z',
  status: 'scheduled',
  home_goals: null,
  away_goals: null,
};

describe('Fixtures', () => {
  function configure(mock: Partial<FixturesService>) {
    TestBed.configureTestingModule({
      imports: [Fixtures],
      providers: [{ provide: FixturesService, useValue: mock }],
    });
  }

  it('renders matches on success', () => {
    configure({ list: () => of([FAKE_FIXTURE]) });
    const fixture = TestBed.createComponent(Fixtures);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Manchester United');
    expect(text).toContain('Newcastle');
  });

  it('shows an empty-state message when there are no matches', () => {
    configure({ list: () => of([]) });
    const fixture = TestBed.createComponent(Fixtures);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('No Premier League matches');
  });

  it('shows an error message on failure', () => {
    configure({ list: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(Fixtures);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.fixtures__status--error')).toBeTruthy();
  });

  it('reloads with the chosen date when the date input changes', () => {
    const list = vi.fn().mockReturnValue(of([FAKE_FIXTURE]));
    configure({ list });
    const fixture = TestBed.createComponent(Fixtures);
    fixture.detectChanges();

    const input: HTMLInputElement = fixture.nativeElement.querySelector('input[type="date"]');
    input.value = '2025-08-16';
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();

    expect(list).toHaveBeenLastCalledWith(2021, '2025-08-16');
  });

  it('reloads with the chosen competition when a league tab is clicked', () => {
    const list = vi.fn().mockReturnValue(of([FAKE_FIXTURE]));
    configure({ list });
    const fixture = TestBed.createComponent(Fixtures);
    fixture.detectChanges();

    const tabs = fixture.nativeElement.querySelectorAll('.league-tabs__tab');
    (tabs[1] as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(list).toHaveBeenLastCalledWith(2014, expect.any(String));
  });
});
