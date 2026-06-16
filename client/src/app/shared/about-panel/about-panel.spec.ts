import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { AboutPanel } from './about-panel';

@Component({
  template: `<app-about-panel heading="About the test"
    ><p>Some explainer text.</p></app-about-panel
  >`,
  imports: [AboutPanel],
})
class Host {}

describe('AboutPanel', () => {
  it('renders the heading and projected content', () => {
    TestBed.configureTestingModule({ imports: [Host] });
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('About the test');
    expect(text).toContain('Some explainer text.');
    expect(fixture.nativeElement.querySelector('details.about')).toBeTruthy();
  });
});
