import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { NotFound } from './not-found';

describe('NotFound', () => {
  it('shows a 404 message and a link home', () => {
    TestBed.configureTestingModule({
      imports: [NotFound],
      providers: [provideRouter([])],
    });
    const fixture = TestBed.createComponent(NotFound);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('404');
    expect(text).toContain('Lost in space');
    expect(fixture.nativeElement.querySelector('a[href="/"]')).toBeTruthy();
  });
});
