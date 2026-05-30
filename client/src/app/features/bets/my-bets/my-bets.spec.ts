import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { MyBets } from './my-bets';
import { Bet, BetsService } from '../../../core/services/bets.service';

const FAKE_BET: Bet = {
  id: 'b1',
  status: 'won',
  stake: '10.00',
  odds: '2.50',
  potential_return: '25.00',
  created_at: '2026-05-28T15:00:00Z',
  legs: [
    {
      id: 'l1',
      fixture_id: 1,
      kind: 'team_win',
      params: { team_id: 33 },
      status: 'won',
      fixture: {
        id: 1,
        external_id: 1001,
        league: { id: 39, name: 'Premier League', country: 'England', logo_url: null },
        home_team: { id: 33, name: 'Arsenal', logo_url: null },
        away_team: { id: 34, name: 'Chelsea', logo_url: null },
        kickoff_at: '2026-05-28T15:00:00Z',
        status: 'finished',
        home_goals: 2,
        away_goals: 0,
      },
    },
  ],
};

describe('MyBets', () => {
  function configure(mock: Partial<BetsService>) {
    TestBed.configureTestingModule({
      imports: [MyBets],
      providers: [provideRouter([]), { provide: BetsService, useValue: mock }],
    });
  }

  it('renders a bet with its leg label', () => {
    configure({ list: () => of([FAKE_BET]) });
    const fixture = TestBed.createComponent(MyBets);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Arsenal win');
    expect(text).toContain('Arsenal v Chelsea');
  });

  it('shows the empty state when there are no bets', () => {
    configure({ list: () => of([]) });
    const fixture = TestBed.createComponent(MyBets);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain("haven't logged any bets");
  });

  it('shows an error message on failure', () => {
    configure({ list: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(MyBets);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.bets__status--error')).toBeTruthy();
  });
});
