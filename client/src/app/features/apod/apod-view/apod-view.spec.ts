import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApodView } from './apod-view';
import { Apod } from '../apod.model';
import { ApodService } from '../apod.service';

const IMAGE_APOD: Apod = {
  date: '2026-05-01',
  title: 'Cosmic Cliffs',
  explanation: 'A nursery of stars in the Carina Nebula.',
  url: 'https://example.test/cliffs.jpg',
  hdurl: 'https://example.test/cliffs-hd.jpg',
  media_type: 'image',
  copyright: 'Webb Telescope',
  thumbnail_url: null,
};

const VIDEO_APOD: Apod = {
  ...IMAGE_APOD,
  date: '2026-05-02',
  url: 'https://www.youtube.com/embed/abc123',
  hdurl: null,
  media_type: 'video',
  copyright: null,
};

function configure(serviceMock: Partial<ApodService>) {
  TestBed.configureTestingModule({
    imports: [ApodView],
    providers: [provideRouter([]), { provide: ApodService, useValue: serviceMock }],
  });
}

describe('ApodView', () => {
  it('renders the picture title and explanation when loaded', async () => {
    configure({ getByDate: () => of(IMAGE_APOD) });
    const fixture = TestBed.createComponent(ApodView);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Cosmic Cliffs');
    expect(text).toContain('Carina Nebula');
    expect(text).toContain('Webb Telescope');
  });

  it('renders an iframe for video APODs', async () => {
    configure({ getByDate: () => of(VIDEO_APOD) });
    const fixture = TestBed.createComponent(ApodView);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const iframe = fixture.nativeElement.querySelector('iframe.apod__video');
    expect(iframe).not.toBeNull();
    expect(fixture.nativeElement.querySelector('img.apod__image')).toBeNull();
  });

  it('shows an error message when the fetch fails', async () => {
    configure({ getByDate: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(ApodView);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const error = fixture.nativeElement.querySelector('.apod--error');
    expect(error?.textContent).toContain("Couldn't load");
  });
});
