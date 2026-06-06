import { TestBed } from '@angular/core/testing';

import { Countdown } from './countdown';

describe('Countdown', () => {
  it('counts down to a future target', () => {
    const fixture = TestBed.createComponent(Countdown);
    const future = new Date(Date.now() + (2 * 86400 + 3 * 3600) * 1000).toISOString();
    fixture.componentRef.setInput('target', future);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('T-');
    expect(text).toMatch(/2d/);
  });

  it('shows a launched state once the target has passed', () => {
    const fixture = TestBed.createComponent(Countdown);
    fixture.componentRef.setInput('target', new Date(Date.now() - 1000).toISOString());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Liftoff');
  });
});
