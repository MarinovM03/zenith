import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { NEVER, of, throwError } from 'rxjs';

import { Home } from './home';
import { Apod } from '../apod/apod.model';
import { ApodService } from '../apod/apod.service';
import { Asteroid } from '../asteroids/asteroid.model';
import { AsteroidService } from '../asteroids/asteroid.service';
import { Launch } from '../launches/launch.model';
import { LaunchService } from '../launches/launch.service';
import { IssPosition } from '../iss/iss.model';
import { IssService } from '../iss/iss.service';
import { MarsPhoto } from '../mars/mars.model';
import { MarsService } from '../mars/mars.service';

const APOD: Apod = {
  date: '2026-06-06',
  title: 'The Hydra Cluster of Galaxies',
  explanation: '',
  url: 'https://example.test/hydra.jpg',
  hdurl: null,
  media_type: 'image',
  copyright: null,
  thumbnail_url: null,
};

const LAUNCH: Launch = {
  id: 'abc',
  name: 'Falcon 9 | Starlink',
  status: { name: 'Go for Launch', abbrev: 'Go' },
  net: new Date(Date.now() + 86_400_000).toISOString(),
  provider: 'SpaceX',
  rocket: 'Falcon 9',
  mission: null,
  mission_description: null,
  pad: null,
  location: null,
  image: null,
  webcast_url: null,
};

function asteroid(hazardous: boolean): Asteroid {
  return {
    id: Math.random().toString(),
    name: 'Rock',
    hazardous,
    diameter_min_m: 10,
    diameter_max_m: 20,
    approach_date: '2026-06-06',
    miss_distance_km: 100000,
    miss_distance_lunar: 0.3,
    velocity_kps: 12,
  };
}

const MARS: MarsPhoto = {
  id: 'm1',
  sol: 1882,
  earth_date: '2026-06-06',
  camera: 'NAVCAM_LEFT',
  img_src: 'https://mars.test/s.jpg',
  full_src: 'https://mars.test/l.jpg',
  rover: 'Perseverance',
};

const ISS: IssPosition = {
  latitude: 12.3,
  longitude: -45.6,
  altitude_km: 421,
  velocity_kph: 27600,
  visibility: 'daylight',
  timestamp: 1780954224,
};

interface ServiceOverrides {
  apod?: Partial<ApodService>;
  launches?: Partial<LaunchService>;
  asteroids?: Partial<AsteroidService>;
  mars?: Partial<MarsService>;
  iss?: Partial<IssService>;
}

function configure(overrides: ServiceOverrides = {}) {
  TestBed.configureTestingModule({
    imports: [Home],
    providers: [
      provideRouter([]),
      {
        provide: ApodService,
        useValue: { getByDate: () => of(APOD), ...overrides.apod },
      },
      {
        provide: LaunchService,
        useValue: { getUpcoming: () => of([LAUNCH]), ...overrides.launches },
      },
      {
        provide: AsteroidService,
        useValue: {
          getFeed: () => of([asteroid(true), asteroid(false)]),
          ...overrides.asteroids,
        },
      },
      {
        provide: MarsService,
        useValue: { getPhotos: () => of([MARS]), ...overrides.mars },
      },
      {
        provide: IssService,
        useValue: { getPosition: () => of(ISS), ...overrides.iss },
      },
    ],
  });
}

async function settle(fixture: ReturnType<typeof TestBed.createComponent>) {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('Home', () => {
  it('shows the APOD hero and live dashboard data', async () => {
    configure();
    const fixture = TestBed.createComponent(Home);
    await settle(fixture);

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('The Hydra Cluster of Galaxies');
    expect(text).toContain('Falcon 9 | Starlink');
    expect(text).toContain('Launches');
    expect(text).toContain('hazardous');
    expect(text).toContain('Sol 1882');
    expect(text).toContain('Live now');
  });

  it('shows the hazardous asteroid count', async () => {
    configure();
    const fixture = TestBed.createComponent(Home);
    await settle(fixture);

    const haz = fixture.nativeElement.querySelector('.dash__haz');
    expect(haz?.textContent?.trim()).toBe('1 hazardous');
  });

  it('distinguishes empty results from failed requests', async () => {
    configure({
      launches: { getUpcoming: () => of([]) },
      asteroids: { getFeed: () => of([]) },
      mars: { getPhotos: () => of([]) },
    });
    const fixture = TestBed.createComponent(Home);
    await settle(fixture);

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('No upcoming launches');
    expect(text).toContain('No close approaches');
    expect(text).toContain('No recent photos');
    expect(text).not.toContain('data unavailable');
  });

  it('shows independent error states and retry controls', async () => {
    const failure = () => throwError(() => new Error('Unavailable'));
    configure({
      apod: { getByDate: failure },
      launches: { getUpcoming: failure },
      asteroids: { getFeed: failure },
      mars: { getPhotos: failure },
      iss: { getPosition: failure },
    });
    const fixture = TestBed.createComponent(Home);
    await settle(fixture);

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain("Today's picture is taking a moment");
    expect(text).toContain('Launch data unavailable');
    expect(text).toContain('Asteroid data unavailable');
    expect(text).toContain('Mars data unavailable');
    expect(text).toContain('ISS position unavailable');
    expect(fixture.nativeElement.querySelectorAll('.home__retry, .dash__retry')).toHaveLength(5);
  });

  it('retries only the failed dashboard resource', async () => {
    const getUpcoming = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('Unavailable')))
      .mockReturnValueOnce(of([LAUNCH]));
    const getFeed = vi.fn(() => of([asteroid(false)]));
    configure({
      launches: { getUpcoming },
      asteroids: { getFeed },
    });
    const fixture = TestBed.createComponent(Home);
    await settle(fixture);

    const retry: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.dash--launch + .dash__retry',
    );
    retry.click();
    fixture.detectChanges();

    expect(getUpcoming).toHaveBeenCalledTimes(2);
    expect(getFeed).toHaveBeenCalledTimes(1);
    expect(fixture.nativeElement.textContent).toContain('Falcon 9 | Starlink');
  });

  it('keeps completed cards useful while another resource is still loading', async () => {
    configure({ launches: { getUpcoming: () => NEVER } });
    const fixture = TestBed.createComponent(Home);
    await settle(fixture);

    const text = fixture.nativeElement.textContent ?? '';
    expect(fixture.nativeElement.querySelector('.dash--launch app-skeleton')).not.toBeNull();
    expect(text).toContain('The Hydra Cluster of Galaxies');
    expect(text).toContain('hazardous');
    expect(text).toContain('Sol 1882');
    expect(text).toContain('Live now');
  });
});
