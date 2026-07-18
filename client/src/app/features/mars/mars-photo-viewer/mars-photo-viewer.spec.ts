import { TestBed } from '@angular/core/testing';

import { MarsPhoto } from '../mars.model';
import { MarsPhotoViewer } from './mars-photo-viewer';

const PHOTO: MarsPhoto = {
  id: 'mars-1',
  sol: 1882,
  earth_date: '2026-06-06',
  camera: 'NAVCAM_LEFT',
  img_src: 'https://mars.test/small.jpg',
  full_src: 'https://mars.test/full.jpg',
  rover: 'Perseverance',
};

describe('MarsPhotoViewer', () => {
  it('renders photo context and emits viewer actions', async () => {
    const fixture = TestBed.createComponent(MarsPhotoViewer);
    fixture.componentRef.setInput('photo', PHOTO);
    fixture.componentRef.setInput('position', 2);
    fixture.componentRef.setInput('total', 4);
    fixture.componentRef.setInput('hasPrevious', true);
    fixture.componentRef.setInput('hasNext', true);

    const previous = vi.fn();
    const next = vi.fn();
    const closed = vi.fn();
    fixture.componentInstance.previous.subscribe(previous);
    fixture.componentInstance.next.subscribe(next);
    fixture.componentInstance.closed.subscribe(closed);

    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const element: HTMLElement = fixture.nativeElement;
    expect(element.textContent).toContain('NAVCAM LEFT');
    expect(element.textContent).toContain('Sol 1882');
    expect(element.textContent).toContain('2 of 4');
    expect(element.querySelector('img')?.getAttribute('src')).toBe(PHOTO.full_src);

    (element.querySelector('[aria-label="Previous photo"]') as HTMLButtonElement).click();
    (element.querySelector('[aria-label="Next photo"]') as HTMLButtonElement).click();
    (element.querySelector('[aria-label="Close photo viewer"]') as HTMLButtonElement).click();

    expect(previous).toHaveBeenCalledOnce();
    expect(next).toHaveBeenCalledOnce();
    expect(closed).toHaveBeenCalledOnce();
  });
});
