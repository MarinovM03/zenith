import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { FavouriteButton } from '../../../shared/favourite-button/favourite-button';
import { ImgFade } from '../../../shared/img-fade/img-fade';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { Countdown } from '../countdown/countdown';
import { Launch, launchStatusTone } from '../launch.model';
import { LaunchService } from '../launch.service';

type LoadState = { status: 'loading' } | { status: 'ready'; launch: Launch } | { status: 'error' };

@Component({
  selector: 'app-launch-detail',
  templateUrl: './launch-detail.html',
  styleUrl: './launch-detail.css',
  imports: [RouterLink, DatePipe, Countdown, Skeleton, ImgFade, FavouriteButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LaunchDetail {
  private readonly route = inject(ActivatedRoute);
  private readonly service = inject(LaunchService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly statusModifier = launchStatusTone;
  protected readonly state = signal<LoadState>({ status: 'loading' });

  private readonly launchId = toSignal(this.route.paramMap.pipe(map((p) => p.get('id'))), {
    initialValue: null as string | null,
  });

  constructor() {
    effect(() => this.fetch(this.launchId()));
  }

  protected isFuture(net: string): boolean {
    return new Date(net).getTime() > Date.now();
  }

  private fetch(id: string | null): void {
    if (!id) {
      this.state.set({ status: 'error' });
      return;
    }
    this.state.set({ status: 'loading' });
    this.service
      .getById(id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (launch) => this.state.set({ status: 'ready', launch }),
        error: () => this.state.set({ status: 'error' }),
      });
  }
}
