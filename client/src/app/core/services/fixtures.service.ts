import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, catchError, forkJoin, map, of } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Competition, GROUPED_COMPETITIONS } from '../../shared/competitions';

export interface FixtureTeam {
  id: number;
  name: string;
  logo_url: string | null;
}

export interface FixtureLeague {
  id: number;
  name: string;
  country: string;
  logo_url: string | null;
}

export type FixtureStatus = 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';

export interface Fixture {
  id: number;
  external_id: number;
  league: FixtureLeague;
  home_team: FixtureTeam;
  away_team: FixtureTeam;
  kickoff_at: string;
  status: FixtureStatus;
  home_goals: number | null;
  away_goals: number | null;
}

@Injectable({ providedIn: 'root' })
export class FixturesService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  list(competitionId: number, date?: string): Observable<Fixture[]> {
    let params = new HttpParams().set('competition_id', competitionId);
    if (date) {
      params = params.set('date', date);
    }
    return this.http.get<Fixture[]>(`${this.baseUrl}/fixtures`, { params });
  }

  /**
   * Fetches the day's fixtures across every competition and groups them.
   * Each competition is requested independently (the free API has no bulk
   * endpoint); a failed competition simply contributes no matches.
   */
  listGroupedByDate(date: string): Observable<CompetitionGroup[]> {
    const calls = GROUPED_COMPETITIONS.map((competition) =>
      this.list(competition.id, date).pipe(
        map((fixtures) => ({ competition, fixtures })),
        catchError(() => of({ competition, fixtures: [] as Fixture[] })),
      ),
    );
    return forkJoin(calls).pipe(map((groups) => groups.filter((g) => g.fixtures.length > 0)));
  }
}

export interface CompetitionGroup {
  competition: Competition;
  fixtures: Fixture[];
}
