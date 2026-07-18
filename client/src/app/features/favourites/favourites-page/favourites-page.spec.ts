import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';

import { FavouritesPage } from './favourites-page';
import {
  Favourite,
  FavouriteLoadStatus,
  FavouriteService,
} from '../../../core/services/favourite.service';

function favourite(id: string, kind: string, payload: Record<string, unknown>): Favourite {
  return { id, kind, ref_id: id, payload, created_at: '2026-06-06T00:00:00Z' };
}

function configure(options: {
  items?: Favourite[];
  status?: FavouriteLoadStatus;
  loadError?: string | null;
  pending?: boolean;
  mutationError?: string | null;
}) {
  const load = vi.fn();
  const remove = vi.fn();
  TestBed.configureTestingModule({
    imports: [FavouritesPage],
    providers: [
      provideRouter([]),
      {
        provide: FavouriteService,
        useValue: {
          items: signal(options.items ?? []).asReadonly(),
          loadStatus: signal(options.status ?? 'loaded').asReadonly(),
          loadError: signal(options.loadError ?? null).asReadonly(),
          load,
          remove,
          isPending: () => options.pending ?? false,
          mutationError: () => options.mutationError ?? null,
        },
      },
    ],
  });
  return { load, remove };
}

describe('FavouritesPage', () => {
  it('shows an empty state when there are no favourites', () => {
    configure({});
    const fixture = TestBed.createComponent(FavouritesPage);
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Nothing saved yet');
  });

  it('lists saved items with their titles', () => {
    configure({
      items: [
        favourite('2026-06-06', 'apod', { title: 'The Hydra Cluster' }),
        favourite('abc', 'launch', { name: 'Falcon 9 | Starlink' }),
      ],
    });
    const fixture = TestBed.createComponent(FavouritesPage);
    fixture.detectChanges();

    const text = fixture.nativeElement.textContent ?? '';
    expect(text).toContain('The Hydra Cluster');
    expect(text).toContain('Falcon 9 | Starlink');
    expect(fixture.nativeElement.querySelectorAll('.favcard').length).toBe(2);
  });

  it('shows a loading state instead of the empty state while loading', () => {
    configure({ status: 'loading' });
    const fixture = TestBed.createComponent(FavouritesPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Loading your favourites');
    expect(fixture.nativeElement.textContent).not.toContain('Nothing saved yet');
  });

  it('shows a load error and retries on request', () => {
    const { load } = configure({ status: 'error', loadError: "We couldn't load favourites." });
    const fixture = TestBed.createComponent(FavouritesPage);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeTruthy();
    fixture.nativeElement.querySelector('.favs__error button').click();
    expect(load).toHaveBeenCalledTimes(1);
  });

  it('disables an item while it is being removed and displays mutation errors', () => {
    configure({
      items: [favourite('2026-06-06', 'apod', { title: 'The Hydra Cluster' })],
      pending: true,
      mutationError: "We couldn't remove this favourite.",
    });
    const fixture = TestBed.createComponent(FavouritesPage);
    fixture.detectChanges();

    const removeButton: HTMLButtonElement = fixture.nativeElement.querySelector('.favcard__remove');
    expect(removeButton.disabled).toBe(true);
    expect(removeButton.textContent).toContain('Removing');
    expect(fixture.nativeElement.querySelector('.favcard__error').textContent).toContain(
      "couldn't remove",
    );
  });
});
