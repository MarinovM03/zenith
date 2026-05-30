import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Fixture } from './fixtures.service';

export type BetStatus = 'pending' | 'won' | 'lost' | 'void';

export type CreateLeg =
  | { kind: 'team_win'; fixture_id: number; team_id: number }
  | { kind: 'team_draw'; fixture_id: number }
  | { kind: 'team_loss'; fixture_id: number; team_id: number }
  | { kind: 'over_under_goals'; fixture_id: number; threshold: number; direction: 'over' | 'under' }
  | { kind: 'btts'; fixture_id: number; expected: boolean };

export interface CreateBetRequest {
  stake?: string | null;
  odds?: string | null;
  legs: CreateLeg[];
}

export interface BetLeg {
  id: string;
  fixture_id: number;
  kind: string;
  params: Record<string, unknown>;
  status: BetStatus;
  fixture: Fixture;
}

export interface Bet {
  id: string;
  status: BetStatus;
  stake: string | null;
  odds: string | null;
  potential_return: string | null;
  created_at: string;
  legs: BetLeg[];
}

@Injectable({ providedIn: 'root' })
export class BetsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  create(request: CreateBetRequest): Observable<Bet> {
    return this.http.post<Bet>(`${this.baseUrl}/bets`, request);
  }

  list(): Observable<Bet[]> {
    return this.http.get<Bet[]>(`${this.baseUrl}/bets`);
  }
}
