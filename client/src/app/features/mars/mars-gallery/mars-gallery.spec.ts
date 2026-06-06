import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { MarsGallery } from './mars-gallery';
import { MarsPhoto } from '../mars.model';
import { MarsService } from '../mars.service';

function photo(id: string): MarsPhoto {
  return {
    id,
    sol: 1882,
    earth_date: '2026-06-06',
    camera: 'NAVCAM_LEFT',
    img_src: 'https://mars.test/s.jpg',
    full_src: 'https://mars.test/l.jpg',
    rover: 'Perseverance',
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
  it('renders the latest photos', async () => {
    configure({ getPhotos: () => of([photo('a'), photo('b')]) });
    const fixture = TestBed.createComponent(MarsGallery);
    await settle(fixture);

    expect(fixture.nativeElement.querySelectorAll('.mphoto').length).toBe(2);
  });

  it('shows an empty state when there are no photos', async () => {
    configure({ getPhotos: () => of([]) });
    const fixture = TestBed.createComponent(MarsGallery);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('No photos available');
  });

  it('shows an error state with retry when loading fails', async () => {
    configure({ getPhotos: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(MarsGallery);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain("Couldn't load Mars photos");
    expect(fixture.nativeElement.querySelector('.mars__retry')).not.toBeNull();
  });
});
