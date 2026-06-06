import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { MarsGallery } from './mars-gallery';
import { MarsPhoto } from '../mars.model';
import { MarsService } from '../mars.service';

function photo(id: number): MarsPhoto {
  return {
    id,
    sol: 1000,
    earth_date: '2024-01-01',
    camera: 'Navigation Camera',
    camera_abbrev: 'NAVCAM',
    img_src: 'https://mars.test/img.jpg',
    rover: 'Curiosity',
  };
}

function configure(serviceMock: Partial<MarsService>) {
  TestBed.configureTestingModule({
    imports: [MarsGallery],
    providers: [{ provide: MarsService, useValue: serviceMock }],
  });
}

async function settle(fixture: ReturnType<typeof TestBed.createComponent>) {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('MarsGallery', () => {
  it('renders photos for the default rover and date', async () => {
    configure({ getPhotos: () => of([photo(1), photo(2)]) });
    const fixture = TestBed.createComponent(MarsGallery);
    await settle(fixture);

    expect(fixture.nativeElement.querySelectorAll('.mphoto').length).toBe(2);
  });

  it('shows an empty state when there are no photos', async () => {
    configure({ getPhotos: () => of([]) });
    const fixture = TestBed.createComponent(MarsGallery);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('No photos for this date');
  });

  it('shows an error state with retry when loading fails', async () => {
    configure({ getPhotos: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(MarsGallery);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain("Couldn't load Mars photos");
    expect(fixture.nativeElement.querySelector('.mars__retry')).not.toBeNull();
  });
});
