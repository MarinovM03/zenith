import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';

import { ImgFade } from '../../../shared/img-fade/img-fade';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { Apod, APOD_EPOCH, shiftDate, todayIso } from '../apod.model';
import { ApodService } from '../apod.service';

const PAGE_DAYS = 30;

@Component({
  selector: 'app-apod-gallery',
  templateUrl: './apod-gallery.html',
  styleUrl: './apod-gallery.css',
  imports: [RouterLink, Skeleton, ImgFade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ApodGallery {
  protected readonly skeletonSlots = Array.from({ length: 8 }, (_, i) => i);

  private readonly service = inject(ApodService);
  private readonly router = inject(Router);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly today = todayIso();
  protected readonly epoch = APOD_EPOCH;

  protected readonly items = signal<Apod[]>([]);
  protected readonly loading = signal(true);
  protected readonly loadingMore = signal(false);
  protected readonly error = signal(false);

  private readonly oldest = signal(this.today);
  protected readonly canLoadOlder = computed(() => this.oldest() > this.epoch);

  constructor() {
    this.loadRange(this.pageStart(this.today), this.today, true);
  }

  private pageStart(end: string): string {
    const start = shiftDate(end, -(PAGE_DAYS - 1));
    return start < this.epoch ? this.epoch : start;
  }

  private loadRange(start: string, end: string, initial: boolean): void {
    if (initial) {
      this.loading.set(true);
    } else {
      this.loadingMore.set(true);
    }
    this.error.set(false);
    this.service
      .getRange(start, end)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (batch) => {
          const newestFirst = [...batch].reverse();
          this.items.update((current) => (initial ? newestFirst : [...current, ...newestFirst]));
          this.oldest.set(start);
          this.loading.set(false);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loading.set(false);
          this.loadingMore.set(false);
          this.error.set(true);
        },
      });
  }

  protected loadOlder(): void {
    const end = shiftDate(this.oldest(), -1);
    if (end < this.epoch) {
      return;
    }
    this.loadRange(this.pageStart(end), end, false);
  }

  protected retry(): void {
    this.items.set([]);
    this.oldest.set(this.today);
    this.loadRange(this.pageStart(this.today), this.today, true);
  }

  protected onDateInput(value: string): void {
    if (value) {
      this.router.navigate(['/apod', value]);
    }
  }

  protected thumb(apod: Apod): string | null {
    return apod.media_type === 'image' ? apod.url : apod.thumbnail_url;
  }
}
