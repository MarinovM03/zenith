import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FavouriteButton } from './favourite-button';
import { AuthService } from '../../core/services/auth.service';
import { FavouriteService } from '../../core/services/favourite.service';

function configure(
  saved: boolean,
  authed: boolean,
  addSpy = () => {},
  removeSpy = () => {},
  pending = false,
  error: string | null = null,
) {
  TestBed.configureTestingModule({
    imports: [FavouriteButton],
    providers: [
      {
        provide: AuthService,
        useValue: { isAuthenticated: signal(authed).asReadonly() },
      },
      {
        provide: FavouriteService,
        useValue: {
          isFavourite: () => saved,
          isPending: () => pending,
          mutationError: () => error,
          add: addSpy,
          remove: removeSpy,
        },
      },
    ],
  });
}

function create(
  saved: boolean,
  authed: boolean,
  addSpy = () => {},
  removeSpy = () => {},
  pending = false,
  error: string | null = null,
) {
  configure(saved, authed, addSpy, removeSpy, pending, error);
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

  it('disables the button while a save is pending', () => {
    const fixture = create(
      false,
      true,
      () => {},
      () => {},
      true,
    );
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(button.textContent).toContain('Saving');
  });

  it('announces mutation failures', () => {
    const fixture = create(
      false,
      true,
      () => {},
      () => {},
      false,
      "We couldn't save this favourite.",
    );

    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      "couldn't save",
    );
  });
});
