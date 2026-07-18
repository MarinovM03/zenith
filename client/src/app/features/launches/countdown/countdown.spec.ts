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

  it('starts ticking after initial stability and clears the timer on destroy', async () => {
    const baseTime = new Date('2026-07-18T20:00:00Z').getTime();
    const nowSpy = vi.spyOn(Date, 'now').mockReturnValue(baseTime);
    let timerId = 1;
    const intervalSpy = vi.spyOn(globalThis, 'setInterval').mockImplementation(() => {
      return timerId++;
    });
    const clearSpy = vi.spyOn(globalThis, 'clearInterval').mockImplementation(() => undefined);
    const fixture = TestBed.createComponent(Countdown);
    fixture.componentRef.setInput('target', new Date(baseTime + 1000).toISOString());
    fixture.detectChanges();
    await fixture.whenStable();

    const countdownCallIndex = intervalSpy.mock.calls.findIndex(([, delay]) => delay === 1000);
    expect(countdownCallIndex).toBeGreaterThanOrEqual(0);
    const tick = intervalSpy.mock.calls[countdownCallIndex][0];
    const countdownTimer = intervalSpy.mock.results[countdownCallIndex].value;
    nowSpy.mockReturnValue(baseTime + 2000);
    if (typeof tick === 'function') {
      tick();
    }
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Liftoff');

    fixture.destroy();
    expect(clearSpy).toHaveBeenCalledWith(countdownTimer);
  });
});
