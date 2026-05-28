import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Login } from './login';
import { AuthService, User } from '../../../core/services/auth.service';

const FAKE_USER: User = {
  id: 'u1',
  email: 'martin@example.com',
  subscription_tier: 'free',
  created_at: '2026-01-01T00:00:00Z',
};

describe('Login', () => {
  function configure(authMock: Partial<AuthService>) {
    TestBed.configureTestingModule({
      imports: [Login],
      providers: [provideRouter([]), { provide: AuthService, useValue: authMock }],
    });
  }

  it('renders the form', () => {
    configure({ login: () => of(FAKE_USER) });
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const heading = fixture.nativeElement.querySelector('h1');
    expect(heading?.textContent).toContain('Log in');
  });

  it('disables submit on invalid form', () => {
    configure({ login: () => of(FAKE_USER) });
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('button[type="submit"]');
    expect(button.disabled).toBe(true);
  });

  it('shows an error message when login fails', async () => {
    configure({ login: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(Login);
    fixture.detectChanges();

    const component = fixture.componentInstance;
    component['form'].setValue({ email: 'a@b.co', password: 'pw' });
    component.submit();
    await fixture.whenStable();
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('.auth__error');
    expect(error?.textContent).toContain('Invalid');
  });
});
