import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { firstValueFrom } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService, TokenResponse, User } from './auth.service';

const USER: User = {
  id: 'user-1',
  email: 'martin@example.com',
  subscription_tier: 'free',
  created_at: '2026-01-01T00:00:00Z',
};

const TOKEN: TokenResponse = {
  access_token: 'access-token',
  token_type: 'bearer',
};

describe('AuthService', () => {
  let service: AuthService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(AuthService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  async function authenticate(): Promise<void> {
    const login = firstValueFrom(service.login(USER.email, 'password'));
    const loginRequest = http.expectOne(`${environment.apiBaseUrl}/auth/login`);
    expect(loginRequest.request.withCredentials).toBe(true);
    loginRequest.flush(TOKEN);
    http.expectOne(`${environment.apiBaseUrl}/auth/me`).flush(USER);
    await login;
  }

  it('shares one refresh request between concurrent subscribers', async () => {
    const first = firstValueFrom(service.refresh());
    const second = firstValueFrom(service.refresh());

    const requests = http.match(`${environment.apiBaseUrl}/auth/refresh`);
    expect(requests).toHaveLength(1);
    expect(requests[0].request.withCredentials).toBe(true);
    requests[0].flush(TOKEN);

    await expect(Promise.all([first, second])).resolves.toEqual([TOKEN, TOKEN]);
    expect(service.accessToken()).toBe(TOKEN.access_token);
  });

  it('allows a new refresh after the shared request completes', async () => {
    const first = firstValueFrom(service.refresh());
    http.expectOne(`${environment.apiBaseUrl}/auth/refresh`).flush(TOKEN);
    await first;

    const second = firstValueFrom(service.refresh());
    http
      .expectOne(`${environment.apiBaseUrl}/auth/refresh`)
      .flush({ ...TOKEN, access_token: 'new-access-token' });
    await second;

    expect(service.accessToken()).toBe('new-access-token');
  });

  it('clears the local session when server logout fails', async () => {
    await authenticate();
    expect(service.isAuthenticated()).toBe(true);

    const logout = firstValueFrom(service.logout());
    http
      .expectOne(`${environment.apiBaseUrl}/auth/logout`)
      .flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });
    await expect(logout).rejects.toBeTruthy();

    expect(service.status()).toBe('unauthenticated');
    expect(service.user()).toBeNull();
    expect(service.accessToken()).toBeNull();
  });
});
