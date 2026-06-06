import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { LaunchesList } from './launches-list';
import { Launch } from '../launch.model';
import { LaunchService } from '../launch.service';

function launch(id: string, name: string, net: string): Launch {
  return {
    id,
    name,
    status: { name: 'Go for Launch', abbrev: 'Go' },
    net,
    provider: 'SpaceX',
    rocket: 'Falcon 9',
    mission: 'Starlink',
    mission_description: null,
    pad: 'SLC-40',
    location: 'Cape Canaveral',
    image: null,
    webcast_url: null,
  };
}

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

function configure(mock: Partial<LaunchService>) {
  TestBed.configureTestingModule({
    imports: [LaunchesList],
    providers: [provideRouter([]), { provide: LaunchService, useValue: mock }],
  });
}

async function settle(fixture: ReturnType<typeof TestBed.createComponent>) {
  fixture.detectChanges();
  await fixture.whenStable();
  fixture.detectChanges();
}

describe('LaunchesList', () => {
  it('shows upcoming launches by default', async () => {
    configure({
      getUpcoming: () => of([launch('a', 'Falcon 9 | Upcoming', FUTURE)]),
      getPrevious: () => of([]),
    });
    const fixture = TestBed.createComponent(LaunchesList);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('Falcon 9 | Upcoming');
  });

  it('loads past launches when the Past tab is clicked', async () => {
    configure({
      getUpcoming: () => of([]),
      getPrevious: () => of([launch('b', 'Atlas V | Past', '2020-01-01T00:00:00Z')]),
    });
    const fixture = TestBed.createComponent(LaunchesList);
    await settle(fixture);

    const tabs = fixture.nativeElement.querySelectorAll('.tabs__btn');
    tabs[1].click();
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain('Atlas V | Past');
  });

  it('shows an error with retry when loading fails', async () => {
    configure({ getUpcoming: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(LaunchesList);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain("Couldn't load launches");
    expect(fixture.nativeElement.querySelector('.launches__retry')).not.toBeNull();
  });
});
