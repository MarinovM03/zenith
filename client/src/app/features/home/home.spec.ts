import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of } from 'rxjs';

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

function configure() {
  TestBed.configureTestingModule({
    imports: [Home],
    providers: [
      provideRouter([]),
      { provide: ApodService, useValue: { getByDate: () => of(APOD) } },
      { provide: LaunchService, useValue: { getUpcoming: () => of([LAUNCH]) } },
      {
        provide: AsteroidService,
        useValue: { getFeed: () => of([asteroid(true), asteroid(false)]) },
      },
      { provide: MarsService, useValue: { getPhotos: () => of([MARS]) } },
      { provide: IssService, useValue: { getPosition: () => of(ISS) } },
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
});
