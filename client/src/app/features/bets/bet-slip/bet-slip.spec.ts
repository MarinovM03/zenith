import { TestBed } from '@angular/core/testing';
import { Router } from '@angular/router';
import { of } from 'rxjs';
import { vi } from 'vitest';

import { BetSlip } from './bet-slip';
import { BetSlipService, Selection } from '../../../core/services/bet-slip.service';
import { Bet, BetsService } from '../../../core/services/bets.service';

const routerStub = { navigateByUrl: vi.fn().mockResolvedValue(true) };

const SELECTION: Selection = {
  key: '1:1',
  fixtureId: 1,
  matchLabel: 'Arsenal v Chelsea',
  label: 'Arsenal',
  leg: { kind: 'team_win', fixture_id: 1, team_id: 33 },
};

const CREATED_BET: Bet = {
  id: 'b1',
  status: 'pending',
  stake: null,
  odds: null,
  potential_return: null,
  created_at: '2026-05-28T15:00:00Z',
  legs: [],
};

describe('BetSlip', () => {
  it('is hidden when the slip is empty', () => {
    TestBed.configureTestingModule({
      imports: [BetSlip],
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: BetsService, useValue: { create: () => of(CREATED_BET) } },
      ],
    });
    const fixture = TestBed.createComponent(BetSlip);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.slip')).toBeNull();
  });

  it('submits selections and clears the slip', () => {
    const create = vi.fn().mockReturnValue(of(CREATED_BET));
    TestBed.configureTestingModule({
      imports: [BetSlip],
      providers: [
        { provide: Router, useValue: routerStub },
        { provide: BetsService, useValue: { create } },
      ],
    });

    const slip = TestBed.inject(BetSlipService);
    slip.toggle(SELECTION);

    const fixture = TestBed.createComponent(BetSlip);
    fixture.detectChanges();

    const submit: HTMLButtonElement = fixture.nativeElement.querySelector('.slip__submit');
    submit.click();

    expect(create).toHaveBeenCalledWith({
      stake: null,
      odds: null,
      legs: [SELECTION.leg],
    });
    expect(slip.count()).toBe(0);
  });
});
