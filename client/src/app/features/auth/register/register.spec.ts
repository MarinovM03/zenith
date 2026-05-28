import { TestBed } from '@angular/core/testing';
import { HttpErrorResponse } from '@angular/common/http';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Register } from './register';
import { AuthService, User } from '../../../core/services/auth.service';

const FAKE_USER: User = {
  id: 'u1',
  email: 'martin@example.com',
  subscription_tier: 'free',
  created_at: '2026-01-01T00:00:00Z',
};

describe('Register', () => {
  function configure(authMock: Partial<AuthService>) {
    TestBed.configureTestingModule({
      imports: [Register],
      providers: [provideRouter([]), { provide: AuthService, useValue: authMock }],
    });
  }

  it('renders the form', () => {
    configure({ register: () => of(FAKE_USER), login: () => of(FAKE_USER) });
    const fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading?.textContent).toContain('Create your account');
  });

  it('shows a duplicate-email error on 409', async () => {
    configure({
      register: () =>
        throwError(() => new HttpErrorResponse({ status: 409, statusText: 'Conflict' })),
      login: () => of(FAKE_USER),
    });
    const fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['form'].setValue({ email: 'a@b.co', password: 'longenough' });
    component.submit();
    await fixture.whenStable();
    fixture.detectChanges();
    const error = fixture.nativeElement.querySelector('.auth__error');
    expect(error?.textContent).toContain('already registered');
  });

  it('shows a generic error on other failures', async () => {
    configure({
      register: () =>
        throwError(() => new HttpErrorResponse({ status: 500, statusText: 'Server' })),
      login: () => of(FAKE_USER),
    });
    const fixture = TestBed.createComponent(Register);
    fixture.detectChanges();
    const component = fixture.componentInstance;
    component['form'].setValue({ email: 'a@b.co', password: 'longenough' });
    component.submit();
    await fixture.whenStable();
    fixture.detectChanges();
    const error = fixture.nativeElement.querySelector('.auth__error');
    expect(error?.textContent).toContain('Could not');
  });
});
