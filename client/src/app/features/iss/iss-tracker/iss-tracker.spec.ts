import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';

import { IssTracker } from './iss-tracker';
import { IssPosition } from '../iss.model';
import { IssService } from '../iss.service';

const POSITION: IssPosition = {
  latitude: 20.5,
  longitude: -75.7,
  altitude_km: 413.3,
  velocity_kph: 27607.5,
  visibility: 'daylight',
  timestamp: 1780954224,
};

describe('IssTracker', () => {
  it('shows the live position, stats, and a map marker', async () => {
    TestBed.configureTestingModule({
      imports: [IssTracker],
      providers: [{ provide: IssService, useValue: { getPosition: () => of(POSITION) } }],
    });
    const fixture = TestBed.createComponent(IssTracker);
    fixture.detectChanges();
    await fixture.whenStable();
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Live ISS Tracker');
    expect(text).toContain('413');
    expect(text).toContain('Daylight');
    expect(fixture.nativeElement.querySelector('.iss__dot')).toBeTruthy();

    fixture.destroy();
  });
});
