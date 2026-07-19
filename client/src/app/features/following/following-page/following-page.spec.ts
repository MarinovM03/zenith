import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { AuthService } from '../../../core/services/auth.service';
import {
  FollowedLaunch,
  FollowedLaunchLoadStatus,
  FollowedLaunchService,
} from '../../../core/services/followed-launch.service';
import { FollowingPage } from './following-page';

const FOLLOWED: FollowedLaunch = {
  id: 'followed-1',
  launch_id: 'launch-1',
  name: 'Artemis II',
  net: '2026-09-01T12:00:00Z',
  status_name: 'To Be Confirmed',
  status_abbrev: 'TBC',
  provider: 'NASA',
  image: null,
  created_at: '2026-07-19T12:00:00Z',
  updated_at: '2026-07-19T12:00:00Z',
};

function configure(options: {
  items?: FollowedLaunch[];
  status?: FollowedLaunchLoadStatus;
  loadError?: string | null;
}) {
  const load = vi.fn();
  const unfollow = vi.fn();
  TestBed.configureTestingModule({
    imports: [FollowingPage],
    providers: [
      provideRouter([]),
      {
        provide: AuthService,
        useValue: { isAuthenticated: signal(true).asReadonly() },
      },
      {
        provide: FollowedLaunchService,
        useValue: {
          items: signal(options.items ?? []).asReadonly(),
          loadStatus: signal(options.status ?? 'loaded').asReadonly(),
          loadError: signal(options.loadError ?? null).asReadonly(),
          load,
          unfollow,
          follow: () => {},
          isFollowing: () => true,
          isPending: () => false,
          mutationError: () => null,
        },
      },
    ],
  });
  return { load, unfollow };
}

describe('FollowingPage', () => {
  it('shows an empty state with a path to upcoming launches', () => {
    configure({});
    const fixture = TestBed.createComponent(FollowingPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("aren't following any launches");
    expect(fixture.nativeElement.querySelector('a')?.getAttribute('href')).toBe('/launches');
  });

  it('lists followed launches with local schedule information', () => {
    configure({ items: [FOLLOWED] });
    const fixture = TestBed.createComponent(FollowingPage);
    fixture.detectChanges();

    const card: HTMLElement = fixture.nativeElement.querySelector('.followcard');
    expect(card.textContent).toContain('Artemis II');
    expect(card.textContent).toContain('NASA');
    expect(card.querySelector('time')?.getAttribute('datetime')).toBe(FOLLOWED.net);
    expect(card.querySelector('.followcard__main button')).toBeNull();
    expect(card.querySelector('.followcard__actions button')?.textContent).toContain('Following');
  });

  it('shows loading before an empty result is known', () => {
    configure({ status: 'loading' });
    const fixture = TestBed.createComponent(FollowingPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading followed launches');
    expect(fixture.nativeElement.textContent).not.toContain("aren't following any launches");
  });

  it('shows a load error and retries', () => {
    const { load } = configure({ status: 'error', loadError: "We couldn't load launches." });
    const fixture = TestBed.createComponent(FollowingPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).not.toBeNull();
    fixture.nativeElement.querySelector('.following__error button').click();
    expect(load).toHaveBeenCalledTimes(1);
  });
});
