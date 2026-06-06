import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FavouriteButton } from './favourite-button';
import { AuthService } from '../../core/services/auth.service';
import { FavouriteService } from '../../core/services/favourite.service';

function configure(saved: boolean, authed: boolean, addSpy = () => {}, removeSpy = () => {}) {
  TestBed.configureTestingModule({
    imports: [FavouriteButton],
    providers: [
      {
        provide: AuthService,
        useValue: { isAuthenticated: signal(authed).asReadonly() },
      },
      {
        provide: FavouriteService,
        useValue: { isFavourite: () => saved, add: addSpy, remove: removeSpy },
      },
    ],
  });
}

function create(saved: boolean, authed: boolean, addSpy = () => {}, removeSpy = () => {}) {
  configure(saved, authed, addSpy, removeSpy);
  const fixture = TestBed.createComponent(FavouriteButton);
  fixture.componentRef.setInput('kind', 'apod');
  fixture.componentRef.setInput('refId', '2026-06-06');
  fixture.detectChanges();
  return fixture;
}

describe('FavouriteButton', () => {
  it('hides when signed out', () => {
    const fixture = create(false, false);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('shows Save when not yet favourited', () => {
    const fixture = create(false, true);
    expect(fixture.nativeElement.textContent).toContain('Save');
  });

  it('adds when toggled on', () => {
    let added = false;
    const fixture = create(false, true, () => (added = true));
    fixture.nativeElement.querySelector('button').click();
    expect(added).toBe(true);
  });

  it('removes when toggled off', () => {
    let removed = false;
    const fixture = create(
      true,
      true,
      () => {},
      () => (removed = true),
    );
    expect(fixture.nativeElement.textContent).toContain('Saved');
    fixture.nativeElement.querySelector('button').click();
    expect(removed).toBe(true);
  });
});
