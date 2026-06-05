import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Home } from './home';
import { Apod } from '../apod/apod.model';
import { ApodService } from '../apod/apod.service';

const APOD: Apod = {
  date: '2026-06-05',
  title: 'The Hydra Cluster of Galaxies',
  explanation: 'A cluster of galaxies.',
  url: 'https://example.test/hydra.jpg',
  hdurl: 'https://example.test/hydra-hd.jpg',
  media_type: 'image',
  copyright: null,
  thumbnail_url: null,
};

function configure(serviceMock: Partial<ApodService>) {
  TestBed.configureTestingModule({
    imports: [Home],
    providers: [provideRouter([]), { provide: ApodService, useValue: serviceMock }],
  });
}

describe('Home', () => {
  it('renders the explore tiles', () => {
    configure({ getByDate: () => of(APOD) });
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Explore');
    expect(text).toContain('Picture of the Day');
    expect(text).toContain('Rocket Launches');
    expect(text).toContain('Near-Earth Asteroids');
  });

  it('shows the featured picture once it loads', async () => {
    configure({ getByDate: () => of(APOD) });
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('The Hydra Cluster of Galaxies');
  });

  it('still renders the explore grid when the hero fails', async () => {
    configure({ getByDate: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(Home);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Rocket Launches');
    expect(text).toContain('Open the archive');
  });
});
