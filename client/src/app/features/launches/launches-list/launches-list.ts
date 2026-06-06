import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { RouterLink } from '@angular/router';

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
  imports: [RouterLink, DatePipe, Countdown, Skeleton, ImgFade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaunchesList {
  private readonly service = inject(LaunchService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly tab = signal<Tab>('upcoming');
  protected readonly state = signal<LoadState>({ status: 'loading' });
  protected readonly skeletonSlots = Array.from({ length: 6 }, (_, i) => i);

  constructor() {
    this.load('upcoming');
  }

  protected setTab(tab: Tab): void {
    if (tab !== this.tab()) {
      this.tab.set(tab);
      this.load(tab);
    }
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
