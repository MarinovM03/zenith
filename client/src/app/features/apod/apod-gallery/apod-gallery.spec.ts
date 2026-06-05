import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { ApodGallery } from './apod-gallery';
import { Apod } from '../apod.model';
import { ApodService } from '../apod.service';

function apod(date: string): Apod {
  return {
    date,
    title: `Title ${date}`,
    explanation: '',
    url: 'https://example.test/img.jpg',
    hdurl: null,
    media_type: 'image',
    copyright: null,
    thumbnail_url: null,
  };
}

function configure(serviceMock: Partial<ApodService>) {
  TestBed.configureTestingModule({
    imports: [ApodGallery],
    providers: [provideRouter([]), { provide: ApodService, useValue: serviceMock }],
  });
}

describe('ApodGallery', () => {
  it('renders a card per day, newest first', async () => {
    configure({
      getRange: () => of([apod('2026-05-01'), apod('2026-05-02'), apod('2026-05-03')]),
    });
    const fixture = TestBed.createComponent(ApodGallery);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const dates = Array.from(fixture.nativeElement.querySelectorAll('.card__date')).map((el) =>
      (el as Element).textContent?.trim(),
    );
    expect(dates).toEqual(['2026-05-03', '2026-05-02', '2026-05-01']);
  });

  it('shows an error with a retry button when the range fails', async () => {
    configure({ getRange: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(ApodGallery);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain("Couldn't load the archive");
    expect(fixture.nativeElement.querySelector('.gallery__retry')).not.toBeNull();
  });
});
