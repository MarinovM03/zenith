import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';

import { MarsService } from './mars.service';

describe('MarsService', () => {
  let service: MarsService;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
    service = TestBed.inject(MarsService);
    http = TestBed.inject(HttpTestingController);
  });

  afterEach(() => http.verify());

  it('requests photos with a page param', () => {
    service.getPhotos(2).subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/mars/photos'));
    expect(req.request.params.get('page')).toBe('2');
    req.flush([]);
  });

  it('defaults to page 1', () => {
    service.getPhotos().subscribe();
    const req = http.expectOne((r) => r.url.endsWith('/mars/photos'));
    expect(req.request.params.get('page')).toBe('1');
    req.flush([]);
  });
});
