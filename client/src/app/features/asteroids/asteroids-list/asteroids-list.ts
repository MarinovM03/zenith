import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AboutPanel } from '../../../shared/about-panel/about-panel';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { Asteroid } from '../asteroid.model';
import { AsteroidService } from '../asteroid.service';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; asteroids: Asteroid[] }
  | { status: 'error' };

const WINDOW_DAYS = 7;

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-asteroids-list',
  templateUrl: './asteroids-list.html',
  styleUrl: './asteroids-list.css',
  imports: [DecimalPipe, Skeleton, AboutPanel],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AsteroidsList {
  private readonly service = inject(AsteroidService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly today = todayIso();
  protected readonly start = signal<string>(this.today);
  protected readonly state = signal<LoadState>({ status: 'loading' });
  protected readonly skeletonSlots = Array.from({ length: 6 }, (_, i) => i);

  protected readonly hazardousCount = computed(() => {
    const current = this.state();
    return current.status === 'ready' ? current.asteroids.filter((a) => a.hazardous).length : 0;
  });

  constructor() {
    this.load(this.start());
  }

  protected onStart(value: string): void {
    if (value) {
      this.start.set(value);
      this.load(value);
    }
  }

  protected retry(): void {
    this.load(this.start());
  }

  private load(start: string): void {
    this.state.set({ status: 'loading' });
    const end = shiftIso(start, WINDOW_DAYS - 1);
    this.service
      .getFeed(start, end)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (asteroids) => this.state.set({ status: 'ready', asteroids }),
        error: () => this.state.set({ status: 'error' }),
      });
  }
}
