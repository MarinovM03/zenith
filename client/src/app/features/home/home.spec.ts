import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';

import { Home } from './home';
import { AuthService, User } from '../../core/services/auth.service';

describe('Home', () => {
  it('greets the signed-in user', () => {
    const user: User = {
      id: 'u1',
      email: 'martin@example.com',
      subscription_tier: 'free',
      created_at: '2026-01-01T00:00:00Z',
    };
    TestBed.configureTestingModule({
      imports: [Home],
      providers: [{ provide: AuthService, useValue: { user: signal(user).asReadonly() } }],
    });
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Zenith');
    expect(text).toContain('martin@example.com');
  });
});
