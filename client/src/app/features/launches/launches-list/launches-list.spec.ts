import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { AuthService } from '../../../core/services/auth.service';
import { FollowedLaunchService } from '../../../core/services/followed-launch.service';
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

function setInput(
  element: HTMLInputElement | HTMLSelectElement,
  value: string,
  eventName: 'input' | 'change',
): void {
  element.value = value;
  element.dispatchEvent(new Event(eventName));
}

const FUTURE = new Date(Date.now() + 86_400_000).toISOString();

function configure(mock: Partial<LaunchService>, authenticated = false) {
  TestBed.configureTestingModule({
    imports: [LaunchesList],
    providers: [
      provideRouter([]),
      { provide: LaunchService, useValue: mock },
      {
        provide: AuthService,
        useValue: { isAuthenticated: signal(authenticated).asReadonly() },
      },
      {
        provide: FollowedLaunchService,
        useValue: {
          isFollowing: () => false,
          isPending: () => false,
          mutationError: () => null,
          follow: () => {},
          unfollow: () => {},
        },
      },
    ],
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

  it('keeps the upcoming follow action outside the card link', async () => {
    configure(
      {
        getUpcoming: () => of([launch('a', 'Falcon 9 | Upcoming', FUTURE)]),
        getPrevious: () => of([]),
      },
      true,
    );
    const fixture = TestBed.createComponent(LaunchesList);
    await settle(fixture);

    const card: HTMLElement = fixture.nativeElement.querySelector('.lcard');
    expect(card.tagName).toBe('ARTICLE');
    expect(card.querySelector('.lcard__link')).not.toBeNull();
    expect(card.querySelector('.lcard__link button')).toBeNull();
    expect(card.querySelector('.lcard__actions button')?.textContent).toContain('Follow launch');
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
    expect(fixture.nativeElement.querySelector('app-follow-launch-button')).toBeNull();
  });

  it('shows an error with retry when loading fails', async () => {
    configure({ getUpcoming: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(LaunchesList);
    await settle(fixture);

    expect(fixture.nativeElement.textContent).toContain("Couldn't load launches");
    expect(fixture.nativeElement.querySelector('.launches__retry')).not.toBeNull();
  });

  it('searches launch names, missions, rockets, and locations', async () => {
    const lunar = launch('a', 'Artemis II', FUTURE);
    lunar.provider = 'NASA';
    lunar.mission = 'Crewed lunar flyby';
    lunar.rocket = 'Space Launch System';
    const starlink = launch('b', 'Falcon 9 | Starlink', FUTURE);
    configure({ getUpcoming: () => of([lunar, starlink]) });
    const fixture = TestBed.createComponent(LaunchesList);
    await settle(fixture);

    const search: HTMLInputElement = fixture.nativeElement.querySelector('input[type="search"]');
    setInput(search, 'lunar', 'input');
    await settle(fixture);

    const cards = fixture.nativeElement.querySelectorAll('.lcard');
    expect(cards).toHaveLength(1);
    expect(cards[0].textContent).toContain('Artemis II');
    expect(fixture.nativeElement.textContent).toContain('Showing 1 of 2 launches');
  });

  it('filters by provider and clears an empty result', async () => {
    const nasa = launch('a', 'Artemis II', FUTURE);
    nasa.provider = 'NASA';
    nasa.mission = 'Crewed lunar flyby';
    nasa.rocket = 'Space Launch System';
    const spacex = launch('b', 'Falcon 9 | Starlink', FUTURE);
    configure({ getUpcoming: () => of([nasa, spacex]) });
    const fixture = TestBed.createComponent(LaunchesList);
    await settle(fixture);

    const provider: HTMLSelectElement = fixture.nativeElement.querySelector('select');
    setInput(provider, 'NASA', 'change');
    await settle(fixture);
    expect(fixture.nativeElement.querySelectorAll('.lcard')).toHaveLength(1);

    const search: HTMLInputElement = fixture.nativeElement.querySelector('input[type="search"]');
    setInput(search, 'Starlink', 'input');
    await settle(fixture);
    expect(fixture.nativeElement.textContent).toContain('No launches match those filters');

    const clear: HTMLButtonElement = fixture.nativeElement.querySelector(
      '.launches__state--compact button',
    );
    clear.click();
    await settle(fixture);
    expect(fixture.nativeElement.querySelectorAll('.lcard')).toHaveLength(2);
    expect(search.value).toBe('');
    expect(provider.value).toBe('');
  });
});
