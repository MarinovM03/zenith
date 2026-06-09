import { DecimalPipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { EMPTY, catchError, interval, startWith, switchMap } from 'rxjs';

import { Skeleton } from '../../../shared/skeleton/skeleton';
import { IssPosition } from '../iss.model';
import { IssService } from '../iss.service';

const POLL_MS = 5000;
const TRAIL_MAX = 60;

interface TrailPoint {
  x: number;
  y: number;
}

@Component({
  selector: 'app-iss-tracker',
  templateUrl: './iss-tracker.html',
  styleUrl: './iss-tracker.css',
  imports: [DecimalPipe, Skeleton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class IssTracker {
  private readonly service = inject(IssService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly position = signal<IssPosition | null>(null);
  protected readonly status = signal<'loading' | 'ready' | 'error'>('loading');
  protected readonly stale = signal(false);
  protected readonly trail = signal<TrailPoint[]>([]);

  protected readonly meridians = [30, 60, 90, 120, 150, 180, 210, 240, 270, 300, 330];
  protected readonly parallels = [30, 60, 90, 120, 150];

  protected readonly marker = computed(() => {
    const current = this.position();
    return current ? this.project(current.latitude, current.longitude) : null;
  });

  constructor() {
    interval(POLL_MS)
      .pipe(
        startWith(0),
        switchMap(() =>
          this.service.getPosition().pipe(
            catchError(() => {
              if (this.position()) {
                this.stale.set(true);
              } else {
                this.status.set('error');
              }
              return EMPTY;
            }),
          ),
        ),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe((position) => this.apply(position));
  }

  protected trailOpacity(index: number): number {
    return ((index + 1) / this.trail().length) * 0.6;
  }

  protected visibilityLabel(): string {
    const current = this.position();
    if (!current) {
      return '';
    }
    if (current.visibility === 'daylight') {
      return 'Daylight';
    }
    if (current.visibility === 'eclipsed') {
      return "Earth's shadow";
    }
    return current.visibility;
  }

  private apply(position: IssPosition): void {
    this.position.set(position);
    this.status.set('ready');
    this.stale.set(false);
    const point = this.project(position.latitude, position.longitude);
    this.trail.update((trail) => [...trail, point].slice(-TRAIL_MAX));
  }

  private project(lat: number, lng: number): TrailPoint {
    return { x: lng + 180, y: 90 - lat };
  }
}
