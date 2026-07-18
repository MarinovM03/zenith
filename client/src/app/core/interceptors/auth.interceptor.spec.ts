import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Observable, Subject, firstValueFrom } from 'rxjs';
import type { Mock } from 'vitest';

import { environment } from '../../../environments/environment';
import { AuthService, TokenResponse } from '../services/auth.service';
import { authInterceptor } from './auth.interceptor';

describe('authInterceptor', () => {
  let client: HttpClient;
  let http: HttpTestingController;
  let accessToken: ReturnType<typeof signal<string | null>>;
  let refreshResponse: Subject<TokenResponse>;
  let refresh: Mock<() => Observable<TokenResponse>>;
  let clearSession: Mock<() => void>;

  beforeEach(() => {
    accessToken = signal<string | null>('expired-token');
    refreshResponse = new Subject<TokenResponse>();
    refresh = vi.fn(() => refreshResponse.asObservable());
    clearSession = vi.fn();

    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([authInterceptor])),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: {
            accessToken: accessToken.asReadonly(),
            refresh,
            clearSession,
          } satisfies Partial<AuthService>,
        },
      ],
    });
    client = TestBed.inject(HttpClient);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('refreshes once and retries a request that receives 401', async () => {
    const result = firstValueFrom(client.get<{ ok: boolean }>(`${environment.apiBaseUrl}/private`));

    const initial = http.expectOne(`${environment.apiBaseUrl}/private`);
    expect(initial.request.headers.get('Authorization')).toBe('Bearer expired-token');
    initial.flush('Expired', { status: 401, statusText: 'Unauthorized' });

    expect(refresh).toHaveBeenCalledTimes(1);
    refreshResponse.next({ access_token: 'fresh-token', token_type: 'bearer' });
    refreshResponse.complete();

    const retry = http.expectOne(`${environment.apiBaseUrl}/private`);
    expect(retry.request.headers.get('Authorization')).toBe('Bearer fresh-token');
    retry.flush({ ok: true });

    await expect(result).resolves.toEqual({ ok: true });
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('clears the session when refresh fails', async () => {
    const result = firstValueFrom(client.get(`${environment.apiBaseUrl}/private`));
    http
      .expectOne(`${environment.apiBaseUrl}/private`)
      .flush('Expired', { status: 401, statusText: 'Unauthorized' });

    refreshResponse.error(new Error('refresh failed'));

    await expect(result).rejects.toThrow('refresh failed');
    expect(clearSession).toHaveBeenCalledTimes(1);
    http.expectNone(`${environment.apiBaseUrl}/private`);
  });

  it('keeps the session when the retried request fails for a non-auth reason', async () => {
    const result = firstValueFrom(client.get(`${environment.apiBaseUrl}/private`));
    http
      .expectOne(`${environment.apiBaseUrl}/private`)
      .flush('Expired', { status: 401, statusText: 'Unauthorized' });

    refreshResponse.next({ access_token: 'fresh-token', token_type: 'bearer' });
    refreshResponse.complete();
    http
      .expectOne(`${environment.apiBaseUrl}/private`)
      .flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });

    await expect(result).rejects.toBeTruthy();
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('does not attach a token or retry session endpoints', async () => {
    const result = firstValueFrom(client.post(`${environment.apiBaseUrl}/auth/refresh`, {}));
    const request = http.expectOne(`${environment.apiBaseUrl}/auth/refresh`);
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush('Rejected', { status: 401, statusText: 'Unauthorized' });

    await expect(result).rejects.toBeTruthy();
    expect(refresh).not.toHaveBeenCalled();
    expect(clearSession).not.toHaveBeenCalled();
  });

  it('does not expose the token to non-Zenith requests', async () => {
    const result = firstValueFrom(client.get('https://example.com/public'));
    const request = http.expectOne('https://example.com/public');
    expect(request.request.headers.has('Authorization')).toBe(false);
    request.flush({ ok: true });

    await expect(result).resolves.toEqual({ ok: true });
    expect(refresh).not.toHaveBeenCalled();
  });
});
