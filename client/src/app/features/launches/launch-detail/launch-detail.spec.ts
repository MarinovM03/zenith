import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LaunchDetail } from './launch-detail';
import { Launch } from '../launch.model';
import { LaunchService } from '../launch.service';

const LAUNCH: Launch = {
  id: 'abc',
  name: 'Falcon 9 | Detail Mission',
  status: { name: 'Go for Launch', abbrev: 'Go' },
  net: new Date(Date.now() + 86_400_000).toISOString(),
  provider: 'SpaceX',
  rocket: 'Falcon 9',
  mission_id: 1234,
  mission: 'Starlink Group 12',
  mission_description: 'A batch of satellites.',
  pad: 'SLC-40',
  location: 'Cape Canaveral',
  image: null,
  webcast_url: 'https://youtube.test/live',
};

function configure(serviceMock: Partial<LaunchService>) {
  TestBed.configureTestingModule({
    imports: [LaunchDetail],
    providers: [
      provideRouter([]),
      provideHttpClient(),
      provideHttpClientTesting(),
      { provide: LaunchService, useValue: serviceMock },
      { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: 'abc' })) } },
    ],
  });
}

async function settle(fixture: ReturnType<typeof TestBed.createComponent>) {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('LaunchDetail', () => {
  it('renders the launch once loaded', async () => {
    configure({ getById: () => of(LAUNCH) });
    const fixture = TestBed.createComponent(LaunchDetail);
    await settle(fixture);

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('Falcon 9 | Detail Mission');
    expect(text).toContain('Starlink Group 12');
    expect(text).toContain('SpaceX');
    expect(fixture.nativeElement.querySelector('app-follow-launch-button')).not.toBeNull();
  });

  it('shows an error state when loading fails', async () => {
    configure({ getById: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(LaunchDetail);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain("Couldn't load this launch");
  });
});
