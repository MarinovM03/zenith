import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { MatchDetailPage } from './match-detail';
import { CompetitionsService, MatchDetail } from '../../../core/services/competitions.service';

const MATCH: MatchDetail = {
  external_id: 537785,
  competition_id: 2021,
  competition_name: 'Premier League',
  competition_emblem: null,
  utc_date: '2025-08-15T19:00:00Z',
  status: 'finished',
  matchday: 1,
  venue: 'Anfield',
  referee: 'Anthony Taylor',
  home: { external_id: 64, name: 'Liverpool FC', logo_url: null },
  away: { external_id: 1044, name: 'AFC Bournemouth', logo_url: null },
  home_goals: 4,
  away_goals: 2,
  home_half_time: 1,
  away_half_time: 0,
};

describe('MatchDetailPage', () => {
  function configure(mock: Partial<CompetitionsService>) {
    TestBed.configureTestingModule({
      imports: [MatchDetailPage],
      providers: [
        provideRouter([]),
        { provide: CompetitionsService, useValue: mock },
        {
          provide: ActivatedRoute,
          useValue: { paramMap: of(convertToParamMap({ id: '537785' })) },
        },
      ],
    });
  }

  it('renders the scoreboard and facts', () => {
    configure({ match: () => of(MATCH) });
    const fixture = TestBed.createComponent(MatchDetailPage);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Liverpool FC');
    expect(text).toContain('4 – 2');
    expect(text).toContain('Anfield');
    expect(text).toContain('Anthony Taylor');
  });

  it('shows an error state on failure', () => {
    configure({ match: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(MatchDetailPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.match-detail__status--error')).toBeTruthy();
  });
});
