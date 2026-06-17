import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { Router, UrlTree, provideRouter } from '@angular/router';
import { Observable, firstValueFrom, of } from 'rxjs';

import { authGuard, guestGuard } from './auth.guard';
import { AuthService, AuthStatus } from '../services/auth.service';

function fakeAuth(authenticated: boolean): Partial<AuthService> {
  const status: AuthStatus = authenticated ? 'authenticated' : 'unauthenticated';
  return {
    isAuthenticated: signal(authenticated).asReadonly(),
    whenSettled: () => of(status),
  };
}

describe('auth guards', () => {
  function setup(authenticated: boolean): void {
    TestBed.configureTestingModule({
      providers: [provideRouter([]), { provide: AuthService, useValue: fakeAuth(authenticated) }],
    });
  }

  function resolve(guard: typeof authGuard): Promise<boolean | UrlTree> {
    const result = TestBed.runInInjectionContext(() =>
      guard({} as never, {} as never),
    ) as Observable<boolean | UrlTree>;
    return firstValueFrom(result);
  }

  it('authGuard lets authenticated users through', async () => {
    setup(true);
    expect(await resolve(authGuard)).toBe(true);
  });

  it('authGuard redirects anonymous users to /login', async () => {
    setup(false);
    const result = await resolve(authGuard);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/login');
  });

  it('guestGuard lets anonymous users through', async () => {
    setup(false);
    expect(await resolve(guestGuard)).toBe(true);
  });

  it('guestGuard redirects authenticated users to the home page', async () => {
    setup(true);
    const result = await resolve(guestGuard);
    expect(result).toBeInstanceOf(UrlTree);
    expect(TestBed.inject(Router).serializeUrl(result as UrlTree)).toBe('/');
  });
});
