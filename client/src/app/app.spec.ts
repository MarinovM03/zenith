import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { of } from 'rxjs';

import { App } from './app';
import { AuthService, AuthStatus, User } from './core/services/auth.service';

function fakeAuth(opts: { status: AuthStatus; user: User | null }): Partial<AuthService> {
  const status = signal(opts.status);
  const user = signal(opts.user);
  return {
    status: status.asReadonly(),
    user: user.asReadonly(),
    isAuthenticated: signal(opts.status === 'authenticated').asReadonly(),
    logout: () => of(void 0),
  };
}

describe('App shell', () => {
  function configure(auth: Partial<AuthService>) {
    TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter([]), { provide: AuthService, useValue: auth }],
    });
  }

  it('renders the shell with a pending auth corner while idle', () => {
    configure(fakeAuth({ status: 'idle', user: null }));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const el = fixture.nativeElement;
    expect(el.querySelector('.shell__auth-pending')).toBeTruthy();
    expect(el.textContent).toContain('Picture of the Day');
    expect(el.textContent).not.toContain('Log in');
  });

  it('shows log in / sign up when unauthenticated', () => {
    configure(fakeAuth({ status: 'unauthenticated', user: null }));
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Log in');
    expect(text).toContain('Sign up');
  });

  it('shows the user email and log out button when authenticated', () => {
    configure(
      fakeAuth({
        status: 'authenticated',
        user: {
          id: 'u1',
          email: 'martin@example.com',
          subscription_tier: 'free',
          created_at: '2026-01-01T00:00:00Z',
        },
      }),
    );
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('martin@example.com');
    expect(text).toContain('Log out');
  });
});
