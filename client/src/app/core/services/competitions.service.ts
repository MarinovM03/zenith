import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface StandingTeam {
  external_id: number;
  name: string;
  logo_url: string | null;
}

export interface StandingRow {
  position: number;
  team: StandingTeam;
  played: number;
  won: number;
  draw: number;
  lost: number;
  goals_for: number;
  goals_against: number;
  goal_difference: number;
  points: number;
}

export interface StandingsGroup {
  label: string | null;
  table: StandingRow[];
}

export interface Scorer {
  player_id: number;
  player_name: string;
  nationality: string | null;
  team_name: string | null;
  team_crest: string | null;
  goals: number | null;
  assists: number | null;
  played_matches: number | null;
}

export interface SquadPlayer {
  id: number;
  name: string;
  position: string | null;
  date_of_birth: string | null;
  nationality: string | null;
}

export interface TeamDetail {
  id: number;
  name: string;
  crest: string | null;
  country: string | null;
  founded: number | null;
  club_colors: string | null;
  venue: string | null;
  website: string | null;
  coach_name: string | null;
  squad: SquadPlayer[];
}

export interface MatchDetail {
  external_id: number;
  competition_id: number;
  competition_name: string;
  competition_emblem: string | null;
  utc_date: string;
  status: 'scheduled' | 'live' | 'finished' | 'postponed' | 'cancelled';
  matchday: number | null;
  venue: string | null;
  referee: string | null;
  home: StandingTeam;
  away: StandingTeam;
  home_goals: number | null;
  away_goals: number | null;
  home_half_time: number | null;
  away_half_time: number | null;
}

export interface PlayerDetail {
  id: number;
  name: string;
  first_name: string | null;
  last_name: string | null;
  date_of_birth: string | null;
  nationality: string | null;
  position: string | null;
  shirt_number: number | null;
  team_id: number | null;
  team_name: string | null;
  team_crest: string | null;
}

@Injectable({ providedIn: 'root' })
export class CompetitionsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  standings(competitionId: number): Observable<StandingsGroup[]> {
    return this.http.get<StandingsGroup[]>(
      `${this.baseUrl}/competitions/${competitionId}/standings`,
    );
  }

  scorers(competitionId: number): Observable<Scorer[]> {
    return this.http.get<Scorer[]>(`${this.baseUrl}/competitions/${competitionId}/scorers`);
  }

  team(teamId: number): Observable<TeamDetail> {
    return this.http.get<TeamDetail>(`${this.baseUrl}/teams/${teamId}`);
  }

  match(matchId: number): Observable<MatchDetail> {
    return this.http.get<MatchDetail>(`${this.baseUrl}/matches/${matchId}`);
  }

  player(playerId: number): Observable<PlayerDetail> {
    return this.http.get<PlayerDetail>(`${this.baseUrl}/players/${playerId}`);
  }
}
