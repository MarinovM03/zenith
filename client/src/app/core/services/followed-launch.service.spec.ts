import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { FollowedLaunch, FollowedLaunchService } from './followed-launch.service';

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

describe('FollowedLaunchService', () => {
  let service: FollowedLaunchService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(),
        provideHttpClientTesting(),
        {
          provide: AuthService,
          useValue: { isAuthenticated: signal(false).asReadonly() },
        },
      ],
    });
    service = TestBed.inject(FollowedLaunchService);
    http = TestBed.inject(HttpTestingController);
    TestBed.flushEffects();
  });

  afterEach(() => http.verify());

  it('loads followed launches in chronological order', () => {
    service.load();
    http
      .expectOne(`${environment.apiBaseUrl}/followed-launches`)
      .flush([
        { ...FOLLOWED, id: 'later', launch_id: 'later', net: '2026-10-01T12:00:00Z' },
        FOLLOWED,
      ]);

    expect(service.items().map((item) => item.launch_id)).toEqual(['launch-1', 'later']);
    expect(service.loadStatus()).toBe('loaded');
  });

  it('follows once while a request is pending', () => {
    service.follow(FOLLOWED.launch_id);
    service.follow(FOLLOWED.launch_id);

    const requests = http.match(`${environment.apiBaseUrl}/followed-launches/launch-1`);
    expect(requests).toHaveLength(1);
    expect(requests[0].request.method).toBe('PUT');
    expect(service.isPending(FOLLOWED.launch_id)).toBe(true);
    requests[0].flush(FOLLOWED);

    expect(service.isFollowing(FOLLOWED.launch_id)).toBe(true);
    expect(service.isPending(FOLLOWED.launch_id)).toBe(false);
  });

  it('unfollows and removes the local record', () => {
    service.load();
    http.expectOne(`${environment.apiBaseUrl}/followed-launches`).flush([FOLLOWED]);

    service.unfollow(FOLLOWED.launch_id);
    const request = http.expectOne(`${environment.apiBaseUrl}/followed-launches/launch-1`);
    expect(request.request.method).toBe('DELETE');
    request.flush(null);

    expect(service.isFollowing(FOLLOWED.launch_id)).toBe(false);
  });

  it('exposes a useful mutation error', () => {
    service.follow(FOLLOWED.launch_id);
    http
      .expectOne(`${environment.apiBaseUrl}/followed-launches/launch-1`)
      .flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });

    expect(service.mutationError(FOLLOWED.launch_id)).toContain("couldn't follow");
    expect(service.isPending(FOLLOWED.launch_id)).toBe(false);
  });
});
