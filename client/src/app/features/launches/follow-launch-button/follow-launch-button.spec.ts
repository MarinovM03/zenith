import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AuthService } from '../../../core/services/auth.service';
import { FollowedLaunchService } from '../../../core/services/followed-launch.service';
import { FollowLaunchButton } from './follow-launch-button';

function create(
  following: boolean,
  authenticated: boolean,
  follow = () => {},
  unfollow = () => {},
  pending = false,
  error: string | null = null,
) {
  TestBed.configureTestingModule({
    imports: [FollowLaunchButton],
    providers: [
      {
        provide: AuthService,
        useValue: { isAuthenticated: signal(authenticated).asReadonly() },
      },
      {
        provide: FollowedLaunchService,
        useValue: {
          isFollowing: () => following,
          isPending: () => pending,
          mutationError: () => error,
          follow,
          unfollow,
        },
      },
    ],
  });
  const fixture = TestBed.createComponent(FollowLaunchButton);
  fixture.componentRef.setInput('launchId', 'launch-1');
  fixture.detectChanges();
  return fixture;
}

describe('FollowLaunchButton', () => {
  it('hides when signed out', () => {
    const fixture = create(false, false);
    expect(fixture.nativeElement.querySelector('button')).toBeNull();
  });

  it('follows an unfollowed launch', () => {
    const follow = vi.fn();
    const fixture = create(false, true, follow);

    expect(fixture.nativeElement.textContent).toContain('Follow launch');
    fixture.nativeElement.querySelector('button').click();
    expect(follow).toHaveBeenCalledWith('launch-1');
  });

  it('unfollows a followed launch', () => {
    const unfollow = vi.fn();
    const fixture = create(true, true, () => {}, unfollow);

    expect(fixture.nativeElement.textContent).toContain('Following');
    fixture.nativeElement.querySelector('button').click();
    expect(unfollow).toHaveBeenCalledWith('launch-1');
  });

  it('disables the control and announces errors', () => {
    const fixture = create(
      false,
      true,
      () => {},
      () => {},
      true,
      "We couldn't follow this launch.",
    );
    const button: HTMLButtonElement = fixture.nativeElement.querySelector('button');

    expect(button.disabled).toBe(true);
    expect(button.getAttribute('aria-busy')).toBe('true');
    expect(fixture.nativeElement.querySelector('[role="alert"]').textContent).toContain(
      "couldn't follow",
    );
  });
});
