import { TestBed } from '@angular/core/testing';
import { of, throwError } from 'rxjs';

import { MarsGallery } from './mars-gallery';
import { MarsPhoto } from '../mars.model';
import { MarsService } from '../mars.service';

function photo(id: string, camera = 'NAVCAM_LEFT'): MarsPhoto {
  return {
    id,
    sol: 1882,
    earth_date: '2026-06-06',
    camera,
    img_src: `https://mars.test/${id}-s.jpg`,
    full_src: `https://mars.test/${id}-l.jpg`,
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
    expect(fixture.nativeElement.querySelector('.mphoto__date').textContent).toContain('2026');
    const images: NodeListOf<HTMLImageElement> =
      fixture.nativeElement.querySelectorAll('.mphoto img');
    expect(images[0].getAttribute('loading')).toBe('eager');
    expect(images[0].getAttribute('fetchpriority')).toBe('high');
    expect(images[1].getAttribute('loading')).toBe('lazy');
  });

  it('filters loaded photos by camera and clears the filter', async () => {
    configure({
      getPhotos: () => of([photo('a', 'NAVCAM_LEFT'), photo('b', 'MASTCAM_Z')]),
    });
    const fixture = TestBed.createComponent(MarsGallery);
    await settle(fixture);

    const select: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    expect(Array.from(select.options).map((option) => option.text)).toEqual([
      'All cameras',
      'MASTCAM Z',
      'NAVCAM LEFT',
    ]);

    select.value = 'NAVCAM_LEFT';
    select.dispatchEvent(new Event('change'));
    await settle(fixture);

    expect(fixture.nativeElement.querySelectorAll('.mphoto')).toHaveLength(1);
    expect(fixture.nativeElement.querySelector('.mphoto__cam').textContent).toContain(
      'NAVCAM LEFT',
    );
    expect(fixture.nativeElement.textContent).toContain('Showing 1 of 2 photos');

    const clear: HTMLButtonElement = fixture.nativeElement.querySelector('.mars__results button');
    clear.click();
    await settle(fixture);
    expect(fixture.nativeElement.querySelectorAll('.mphoto')).toHaveLength(2);
    expect(select.value).toBe('');
  });

  it('opens a photo in the viewer and navigates between loaded photos', async () => {
    configure({ getPhotos: () => of([photo('a'), photo('b', 'MASTCAM_Z')]) });
    const fixture = TestBed.createComponent(MarsGallery);
    await settle(fixture);

    const cards: NodeListOf<HTMLButtonElement> = fixture.nativeElement.querySelectorAll('.mphoto');
    cards[0].click();
    await settle(fixture);

    let viewer: HTMLElement = fixture.nativeElement.querySelector('app-mars-photo-viewer');
    expect(viewer).not.toBeNull();
    expect(viewer.textContent).toContain('1 of 2');

    const next: HTMLButtonElement = viewer.querySelector('[aria-label="Next photo"]')!;
    next.click();
    await settle(fixture);

    viewer = fixture.nativeElement.querySelector('app-mars-photo-viewer');
    expect(viewer.textContent).toContain('MASTCAM Z');

    const close: HTMLButtonElement = viewer.querySelector('[aria-label="Close photo viewer"]')!;
    close.click();
    await settle(fixture);
    expect(fixture.nativeElement.querySelector('app-mars-photo-viewer')).toBeNull();
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
