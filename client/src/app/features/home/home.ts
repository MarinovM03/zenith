import { DatePipe, DecimalPipe, isPlatformBrowser } from '@angular/common';
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';
import { first } from 'rxjs';

import { AuthService } from '../../core/services/auth.service';
import { FollowedLaunch, FollowedLaunchService } from '../../core/services/followed-launch.service';
import { ImgFade } from '../../shared/img-fade/img-fade';
import { Skeleton } from '../../shared/skeleton/skeleton';
import { DashboardCard } from './dashboard-card/dashboard-card';
import { Apod } from '../apod/apod.model';
import { ApodService } from '../apod/apod.service';
import { AsteroidService } from '../asteroids/asteroid.service';
import { Countdown } from '../launches/countdown/countdown';
import { Launch } from '../launches/launch.model';
import { LaunchService } from '../launches/launch.service';
import { IssPosition } from '../iss/iss.model';
import { IssService } from '../iss/iss.service';
import { MarsPhoto } from '../mars/mars.model';
import { MarsService } from '../mars/mars.service';

type LoadState<T> =
  | { status: 'loading' }
  | { status: 'ready'; data: T }
  | { status: 'empty' }
  | { status: 'error' };

interface AsteroidStats {
  total: number;
  hazardous: number;
}

function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

function shiftIso(iso: string, days: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.css',
  imports: [RouterLink, ImgFade, Skeleton, Countdown, DashboardCard, DatePipe, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly apodService = inject(ApodService);
  private readonly launchService = inject(LaunchService);
  private readonly asteroidService = inject(AsteroidService);
  private readonly marsService = inject(MarsService);
  private readonly issService = inject(IssService);
  private readonly auth = inject(AuthService);
  private readonly followedLaunches = inject(FollowedLaunchService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly hero = signal<LoadState<Apod>>({ status: 'loading' });
  protected readonly launch = signal<LoadState<Launch>>({ status: 'loading' });
  protected readonly asteroid = signal<LoadState<AsteroidStats>>({ status: 'loading' });
  protected readonly mars = signal<LoadState<MarsPhoto>>({ status: 'loading' });
  protected readonly iss = signal<LoadState<IssPosition>>({ status: 'loading' });
  protected readonly isAuthenticated = this.auth.isAuthenticated;
  protected readonly nextFollowedLaunch = computed<LoadState<FollowedLaunch>>(() => {
    const status = this.followedLaunches.loadStatus();
    if (status === 'idle' || status === 'loading') {
      return { status: 'loading' };
    }
    if (status === 'error') {
      return { status: 'error' };
    }

    const now = Date.now();
    const launch = this.followedLaunches.items().find((item) => Date.parse(item.net) >= now);
    return launch ? { status: 'ready', data: launch } : { status: 'empty' };
  });

  constructor() {
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      inject(ApplicationRef)
        .isStable.pipe(
          first((isStable) => isStable),
          takeUntilDestroyed(this.destroyRef),
        )
        .subscribe(() => {
          this.loadHero();
          this.loadLaunch();
          this.loadAsteroids();
          this.loadMars();
          this.loadIss();
        });
    }
  }

  protected loadHero(): void {
    this.hero.set({ status: 'loading' });
    this.apodService
      .getByDate(null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (apod) => this.hero.set({ status: 'ready', data: apod }),
        error: () => this.hero.set({ status: 'error' }),
      });
  }

  protected loadLaunch(): void {
    this.launch.set({ status: 'loading' });
    this.launchService
      .getUpcoming(1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) =>
          this.launch.set(list[0] ? { status: 'ready', data: list[0] } : { status: 'empty' }),
        error: () => this.launch.set({ status: 'error' }),
      });
  }

  protected loadFollowedLaunches(): void {
    this.followedLaunches.load();
  }

  protected loadAsteroids(): void {
    this.asteroid.set({ status: 'loading' });
    const start = todayIso();
    this.asteroidService
      .getFeed(start, shiftIso(start, 6))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rocks) => {
          this.asteroid.set(
            rocks.length
              ? {
                  status: 'ready',
                  data: {
                    total: rocks.length,
                    hazardous: rocks.filter((rock) => rock.hazardous).length,
                  },
                }
              : { status: 'empty' },
          );
        },
        error: () => this.asteroid.set({ status: 'error' }),
      });
  }

  protected loadMars(): void {
    this.mars.set({ status: 'loading' });
    this.marsService
      .getPhotos(1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photos) =>
          this.mars.set(photos[0] ? { status: 'ready', data: photos[0] } : { status: 'empty' }),
        error: () => this.mars.set({ status: 'error' }),
      });
  }

  protected loadIss(): void {
    this.iss.set({ status: 'loading' });
    this.issService
      .getPosition()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (position) => this.iss.set({ status: 'ready', data: position }),
        error: () => this.iss.set({ status: 'error' }),
      });
  }

  protected heroImage(apod: Apod): string | null {
    return apod.media_type === 'image' ? apod.url : apod.thumbnail_url;
  }
}
