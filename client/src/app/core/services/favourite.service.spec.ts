import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';
import { Favourite, FavouriteService } from './favourite.service';

const FAVOURITE: Favourite = {
  id: 'favourite-1',
  kind: 'apod',
  ref_id: '2026-06-06',
  payload: { title: 'The Hydra Cluster' },
  created_at: '2026-06-06T00:00:00Z',
};

describe('FavouriteService', () => {
  let service: FavouriteService;
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
    service = TestBed.inject(FavouriteService);
    http = TestBed.inject(HttpTestingController);
    TestBed.flushEffects();
  });

  afterEach(() => http.verify());

  it('distinguishes loading from a successfully loaded empty collection', () => {
    service.load();
    expect(service.loadStatus()).toBe('loading');

    http.expectOne(`${environment.apiBaseUrl}/favourites`).flush([]);

    expect(service.loadStatus()).toBe('loaded');
    expect(service.loadError()).toBeNull();
    expect(service.items()).toEqual([]);
  });

  it('reports load errors without replacing existing items', () => {
    service.load();
    http.expectOne(`${environment.apiBaseUrl}/favourites`).flush([FAVOURITE]);

    service.load();
    http
      .expectOne(`${environment.apiBaseUrl}/favourites`)
      .flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });

    expect(service.loadStatus()).toBe('error');
    expect(service.loadError()).toContain("couldn't load");
    expect(service.items()).toEqual([FAVOURITE]);
  });

  it('exposes pending and error state for a failed add', () => {
    service.add('apod', FAVOURITE.ref_id, FAVOURITE.payload);
    service.add('apod', FAVOURITE.ref_id, FAVOURITE.payload);

    expect(service.isPending('apod', FAVOURITE.ref_id)).toBe(true);
    const requests = http.match(`${environment.apiBaseUrl}/favourites`);
    expect(requests).toHaveLength(1);
    requests[0].flush('Unavailable', { status: 503, statusText: 'Service Unavailable' });

    expect(service.isPending('apod', FAVOURITE.ref_id)).toBe(false);
    expect(service.mutationError('apod', FAVOURITE.ref_id)).toContain("couldn't save");
    expect(service.items()).toEqual([]);
  });

  it('adds a successful favourite and clears its pending state', () => {
    service.add('apod', FAVOURITE.ref_id, FAVOURITE.payload);
    http.expectOne(`${environment.apiBaseUrl}/favourites`).flush(FAVOURITE);

    expect(service.items()).toEqual([FAVOURITE]);
    expect(service.isFavourite('apod', FAVOURITE.ref_id)).toBe(true);
    expect(service.isPending('apod', FAVOURITE.ref_id)).toBe(false);
    expect(service.mutationError('apod', FAVOURITE.ref_id)).toBeNull();
  });

  it('removes a successful favourite and sends its identity as query parameters', () => {
    service.load();
    http.expectOne(`${environment.apiBaseUrl}/favourites`).flush([FAVOURITE]);

    service.remove('apod', FAVOURITE.ref_id);
    const request = http.expectOne((req) => req.url === `${environment.apiBaseUrl}/favourites`);
    expect(request.request.params.get('kind')).toBe('apod');
    expect(request.request.params.get('ref_id')).toBe(FAVOURITE.ref_id);
    request.flush(null);

    expect(service.items()).toEqual([]);
    expect(service.isPending('apod', FAVOURITE.ref_id)).toBe(false);
  });
});
