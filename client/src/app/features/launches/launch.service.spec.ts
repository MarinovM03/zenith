import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { Launch } from './launch.model';
import { LaunchService } from './launch.service';

function launch(id: string): Launch {
  return {
    id,
    name: `Falcon 9 | ${id}`,
    status: { name: 'Go for Launch', abbrev: 'Go' },
    net: '2026-07-01T12:00:00Z',
    provider: 'SpaceX',
    rocket: 'Falcon 9',
    mission: 'Starlink',
    mission_description: 'Sats.',
    pad: 'SLC-40',
    location: 'Cape Canaveral',
    image: null,
    webcast_url: null,
  };
}

describe('LaunchService', () => {
  let service: LaunchService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(LaunchService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests upcoming launches with a limit', () => {
    service.getUpcoming(5).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/launches/upcoming'));
    expect(req.request.params.get('limit')).toBe('5');
    req.flush([launch('a')]);
  });

  it('serves a launch from cache after it was listed', () => {
    service.getUpcoming().subscribe();
    http.expectOne((r) => r.url.endsWith('/launches/upcoming')).flush([launch('cached')]);

    let result: Launch | undefined;
    service.getById('cached').subscribe((l) => (result = l));
    http.expectNone((r) => r.url.endsWith('/launches/cached'));
    expect(result?.id).toBe('cached');
  });
});
