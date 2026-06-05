import { NgTemplateOutlet } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

import { Apod } from '../apod/apod.model';
import { ApodService } from '../apod/apod.service';

type IconKey = 'apod' | 'launch' | 'mars' | 'asteroid';

interface ExploreTile {
  readonly title: string;
  readonly description: string;
  readonly link: string | null;
  readonly soon: boolean;
  readonly icon: IconKey;
}

type HeroState = { status: 'loading' } | { status: 'ready'; apod: Apod } | { status: 'error' };

@Component({
  selector: 'app-home',
  templateUrl: './home.html',
  styleUrl: './home.css',
  imports: [RouterLink, NgTemplateOutlet],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Home {
  private readonly service = inject(ApodService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly hero = signal<HeroState>({ status: 'loading' });

  protected readonly tiles: readonly ExploreTile[] = [
    {
      title: 'Picture of the Day',
      description: "NASA's daily astronomy image, with a browsable archive back to 1995.",
      link: '/apod',
      soon: false,
      icon: 'apod',
    },
    {
      title: 'Rocket Launches',
      description: 'Upcoming and past launches across every provider, with live countdowns.',
      link: null,
      soon: true,
      icon: 'launch',
    },
    {
      title: 'Mars Rover',
      description: 'Photographs from the rovers exploring the surface of Mars.',
      link: null,
      soon: true,
      icon: 'mars',
    },
    {
      title: 'Near-Earth Asteroids',
      description: 'Watch space rocks making their closest approaches to Earth.',
      link: null,
      soon: true,
      icon: 'asteroid',
    },
  ];

  constructor() {
    this.service
      .getByDate(null)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (apod) => this.hero.set({ status: 'ready', apod }),
        error: () => this.hero.set({ status: 'error' }),
      });
  }

  protected heroImage(apod: Apod): string | null {
    return apod.media_type === 'image' ? apod.url : apod.thumbnail_url;
  }
}
