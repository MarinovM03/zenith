import { HttpClient } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Observable, catchError, of, switchMap, tap } from 'rxjs';

import { environment } from '../../../environments/environment';

export interface User {
  id: string;
  email: string;
  subscription_tier: string;
  created_at: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
}

export type AuthStatus = 'idle' | 'loading' | 'authenticated' | 'unauthenticated';

interface AuthState {
  user: User | null;
  accessToken: string | null;
  status: AuthStatus;
}

const INITIAL_STATE: AuthState = {
  user: null,
  accessToken: null,
  status: 'idle',
};

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly state = signal<AuthState>(INITIAL_STATE);

  readonly user = computed(() => this.state().user);
  readonly accessToken = computed(() => this.state().accessToken);
  readonly status = computed(() => this.state().status);
  readonly isAuthenticated = computed(() => this.state().status === 'authenticated');

  initialize(): Observable<User | null> {
    this.state.update((s) => ({ ...s, status: 'loading' }));
    return this.refresh().pipe(
      switchMap(() => this.fetchMe()),
      catchError(() => {
        this.state.set({ ...INITIAL_STATE, status: 'unauthenticated' });
        return of(null);
      }),
    );
  }

  register(email: string, password: string): Observable<User> {
    return this.http.post<User>(`${this.baseUrl}/auth/register`, { email, password });
  }

  login(email: string, password: string): Observable<User> {
    return this.http
      .post<TokenResponse>(
        `${this.baseUrl}/auth/login`,
        { email, password },
        { withCredentials: true },
      )
      .pipe(
        tap((response) => this.setAccessToken(response.access_token)),
        switchMap(() => this.fetchMe()),
      );
  }

  logout(): Observable<void> {
    return this.http
      .post<void>(`${this.baseUrl}/auth/logout`, {}, { withCredentials: true })
      .pipe(tap(() => this.state.set({ ...INITIAL_STATE, status: 'unauthenticated' })));
  }

  refresh(): Observable<TokenResponse> {
    return this.http
      .post<TokenResponse>(`${this.baseUrl}/auth/refresh`, {}, { withCredentials: true })
      .pipe(tap((response) => this.setAccessToken(response.access_token)));
  }

  fetchMe(): Observable<User> {
    return this.http.get<User>(`${this.baseUrl}/auth/me`).pipe(
      tap((user) =>
        this.state.update((s) => ({
          ...s,
          user,
          status: 'authenticated',
        })),
      ),
    );
  }

  private setAccessToken(token: string): void {
    this.state.update((s) => ({ ...s, accessToken: token }));
  }
}
