import { DecimalPipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { ImgFade } from '../../shared/img-fade/img-fade';
import { Skeleton } from '../../shared/skeleton/skeleton';
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

type HeroState = { status: 'loading' } | { status: 'ready'; apod: Apod } | { status: 'error' };

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
  imports: [RouterLink, ImgFade, Skeleton, Countdown, DecimalPipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly apod = inject(ApodService);
  private readonly launches = inject(LaunchService);
  private readonly asteroids = inject(AsteroidService);
  private readonly mars = inject(MarsService);
  private readonly iss = inject(IssService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly hero = signal<HeroState>({ status: 'loading' });

  protected readonly launchLoading = signal(true);
  protected readonly nextLaunch = signal<Launch | null>(null);

  protected readonly asteroidLoading = signal(true);
  protected readonly asteroidStats = signal<AsteroidStats | null>(null);

  protected readonly marsLoading = signal(true);
  protected readonly latestMars = signal<MarsPhoto | null>(null);

  protected readonly issLoading = signal(true);
  protected readonly issPosition = signal<IssPosition | null>(null);

  constructor() {
    this.apod
      .getByDate(null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (apod) => this.hero.set({ status: 'ready', apod }),
        error: () => this.hero.set({ status: 'error' }),
      });

    this.launches
      .getUpcoming(1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (list) => {
          this.nextLaunch.set(list[0] ?? null);
          this.launchLoading.set(false);
        },
        error: () => this.launchLoading.set(false),
      });

    const start = todayIso();
    this.asteroids
      .getFeed(start, shiftIso(start, 6))
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (rocks) => {
          this.asteroidStats.set({
            total: rocks.length,
            hazardous: rocks.filter((r) => r.hazardous).length,
          });
          this.asteroidLoading.set(false);
        },
        error: () => this.asteroidLoading.set(false),
      });

    this.mars
      .getPhotos(1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photos) => {
          this.latestMars.set(photos[0] ?? null);
          this.marsLoading.set(false);
        },
        error: () => this.marsLoading.set(false),
      });

    this.iss
      .getPosition()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (position) => {
          this.issPosition.set(position);
          this.issLoading.set(false);
        },
        error: () => this.issLoading.set(false),
      });
  }

  protected heroImage(apod: Apod): string | null {
    return apod.media_type === 'image' ? apod.url : apod.thumbnail_url;
  }
}
