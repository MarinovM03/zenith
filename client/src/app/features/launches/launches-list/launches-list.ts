import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { AboutPanel } from '../../../shared/about-panel/about-panel';
import { ImgFade } from '../../../shared/img-fade/img-fade';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { Countdown } from '../countdown/countdown';
import { Launch, launchStatusTone } from '../launch.model';
import { LaunchService } from '../launch.service';

type Tab = 'upcoming' | 'previous';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; launches: Launch[] }
  | { status: 'error' };

@Component({
  selector: 'app-launches-list',
  templateUrl: './launches-list.html',
  styleUrl: './launches-list.css',
  imports: [RouterLink, DatePipe, Countdown, Skeleton, ImgFade, AboutPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaunchesList {
  private readonly service = inject(LaunchService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tab = signal<Tab>('upcoming');
  protected readonly state = signal<LoadState>({ status: 'loading' });
  protected readonly query = signal('');
  protected readonly provider = signal('');
  protected readonly skeletonSlots = Array.from({ length: 6 }, (_, i) => i);

  protected readonly providers = computed(() => {
    const current = this.state();
    if (current.status !== 'ready') {
      return [];
    }
    return [
      ...new Set(
        current.launches
          .map((launch) => launch.provider)
          .filter((provider): provider is string => Boolean(provider)),
      ),
    ].sort((a, b) => a.localeCompare(b));
  });

  protected readonly filteredLaunches = computed(() => {
    const current = this.state();
    if (current.status !== 'ready') {
      return [];
    }
    const query = this.query().trim().toLocaleLowerCase();
    const provider = this.provider();
    return current.launches.filter((launch) => {
      const matchesProvider = !provider || launch.provider === provider;
      const searchable = [
        launch.name,
        launch.mission,
        launch.provider,
        launch.rocket,
        launch.location,
      ]
        .filter((value): value is string => Boolean(value))
        .join(' ')
        .toLocaleLowerCase();
      return matchesProvider && (!query || searchable.includes(query));
    });
  });

  protected readonly hasFilters = computed(
    () => this.query().trim().length > 0 || this.provider().length > 0,
  );

  constructor() {
    this.load('upcoming');
  }

  protected setTab(tab: Tab): void {
    if (tab !== this.tab()) {
      this.tab.set(tab);
      this.clearFilters();
      this.load(tab);
    }
  }

  protected onSearch(event: Event): void {
    this.query.set((event.target as HTMLInputElement).value);
  }

  protected onProviderChange(event: Event): void {
    this.provider.set((event.target as HTMLSelectElement).value);
  }

  protected clearFilters(): void {
    this.query.set('');
    this.provider.set('');
  }

  protected retry(): void {
    this.load(this.tab());
  }

  protected readonly statusModifier = launchStatusTone;

  private load(tab: Tab): void {
    this.state.set({ status: 'loading' });
    const request = tab === 'upcoming' ? this.service.getUpcoming() : this.service.getPrevious();
    request.pipe(takeUntilDestroyed(this.destroyRef)).subscribe({
      next: (launches) => this.state.set({ status: 'ready', launches }),
      error: () => this.state.set({ status: 'error' }),
    });
  }
}
