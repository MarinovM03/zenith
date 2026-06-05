import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed, toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Router, RouterLink } from '@angular/router';
import { map } from 'rxjs';

import { Apod, APOD_EPOCH, shiftDate, todayIso } from '../apod.model';
import { ApodService } from '../apod.service';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; apod: Apod }
  | { status: 'error'; message: string };

@Component({
  selector: 'app-apod-view',
  templateUrl: './apod-view.html',
  styleUrl: './apod-view.css',
  imports: [RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApodView {
  private readonly route = inject(ActivatedRoute);
  private readonly router = inject(Router);
  private readonly service = inject(ApodService);
  private readonly sanitizer = inject(DomSanitizer);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly today = todayIso();
  protected readonly epoch = APOD_EPOCH;

  private readonly routeDate = toSignal(this.route.paramMap.pipe(map((p) => p.get('date'))), {
    initialValue: null as string | null,
  });

  protected readonly state = signal<LoadState>({ status: 'loading' });

  protected readonly currentDate = computed(() => this.routeDate() ?? this.today);
  protected readonly prevDate = computed(() => {
    const d = shiftDate(this.currentDate(), -1);
    return d < this.epoch ? null : d;
  });
  protected readonly nextDate = computed(() => {
    const d = shiftDate(this.currentDate(), +1);
    return d > this.today ? null : d;
  });

  protected readonly safeVideoUrl = computed<SafeResourceUrl | null>(() => {
    const s = this.state();
    if (s.status !== 'ready' || s.apod.media_type !== 'video') return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(s.apod.url);
  });

  constructor() {
    effect(() => {
      const date = this.routeDate();
      this.fetch(date);
    });
  }

  private fetch(date: string | null): void {
    this.state.set({ status: 'loading' });
    this.service
      .getByDate(date)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (apod) => this.state.set({ status: 'ready', apod }),
        error: () =>
          this.state.set({
            status: 'error',
            message: "Couldn't load this picture. Try again.",
          }),
      });
  }

  protected onDateInput(value: string): void {
    if (!value) return;
    if (value === this.today) {
      this.router.navigateByUrl('/apod');
    } else {
      this.router.navigate(['/apod', value]);
    }
  }
}
