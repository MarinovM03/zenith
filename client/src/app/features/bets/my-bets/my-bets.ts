import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Bet, BetLeg, BetsService } from '../../../core/services/bets.service';
import { Crest } from '../../../shared/crest/crest';

type BetsState = { kind: 'loading' } | { kind: 'loaded'; bets: Bet[] } | { kind: 'error' };

@Component({
  selector: 'app-my-bets',
  templateUrl: './my-bets.html',
  styleUrl: './my-bets.css',
  imports: [DatePipe, RouterLink, Crest],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MyBets implements OnInit {
  private readonly bets = inject(BetsService);

  protected readonly state = signal<BetsState>({ kind: 'loading' });

  ngOnInit(): void {
    this.bets.list().subscribe({
      next: (bets) => this.state.set({ kind: 'loaded', bets }),
      error: () => this.state.set({ kind: 'error' }),
    });
  }

  protected matchLabel(leg: BetLeg): string {
    return `${leg.fixture.home_team.name} v ${leg.fixture.away_team.name}`;
  }

  protected legLabel(leg: BetLeg): string {
    const params = leg.params;
    switch (leg.kind) {
      case 'team_win':
        return `${this.teamName(leg, params['team_id'])} win`;
      case 'team_loss':
        return `${this.teamName(leg, params['team_id'])} to lose`;
      case 'team_draw':
        return 'Draw';
      case 'over_under_goals':
        return `${params['direction'] === 'over' ? 'Over' : 'Under'} ${params['threshold']}`;
      case 'btts':
        return params['expected'] ? 'Both teams to score' : 'No both teams to score';
      default:
        return leg.kind;
    }
  }

  private teamName(leg: BetLeg, teamId: unknown): string {
    if (teamId === leg.fixture.home_team.id) {
      return leg.fixture.home_team.name;
    }
    if (teamId === leg.fixture.away_team.id) {
      return leg.fixture.away_team.name;
    }
    return 'Team';
  }
}
