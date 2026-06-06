import { TitleCasePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ImgFade } from '../../../shared/img-fade/img-fade';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { MARS_ROVERS, MarsPhoto } from '../mars.model';
import { MarsService } from '../mars.service';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; photos: MarsPhoto[] }
  | { status: 'error' };

function isoDaysAgo(days: number): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d.toISOString().slice(0, 10);
}

@Component({
  selector: 'app-mars-gallery',
  templateUrl: './mars-gallery.html',
  styleUrl: './mars-gallery.css',
  imports: [Skeleton, ImgFade, TitleCasePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarsGallery {
  private readonly service = inject(MarsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly rovers = MARS_ROVERS;
  protected readonly today = isoDaysAgo(0);
  protected readonly rover = signal<string>('curiosity');
  protected readonly date = signal<string>(isoDaysAgo(7));

  protected readonly state = signal<LoadState>({ status: 'loading' });
  protected readonly loadingMore = signal(false);
  protected readonly noMore = signal(false);
  protected readonly skeletonSlots = Array.from({ length: 8 }, (_, i) => i);

  private page = 1;

  constructor() {
    this.reload();
  }

  protected onRover(rover: string): void {
    this.rover.set(rover);
    this.reload();
  }

  protected onDate(date: string): void {
    if (date) {
      this.date.set(date);
      this.reload();
    }
  }

  protected retry(): void {
    this.reload();
  }

  protected loadMore(): void {
    const current = this.state();
    if (current.status !== 'ready' || this.loadingMore()) {
      return;
    }
    this.loadingMore.set(true);
    this.page += 1;
    this.service
      .getPhotos(this.rover(), this.date(), this.page)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (more) => {
          this.state.set({ status: 'ready', photos: [...current.photos, ...more] });
          this.noMore.set(more.length === 0);
          this.loadingMore.set(false);
        },
        error: () => this.loadingMore.set(false),
      });
  }

  private reload(): void {
    this.page = 1;
    this.noMore.set(false);
    this.state.set({ status: 'loading' });
    this.service
      .getPhotos(this.rover(), this.date(), 1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photos) => this.state.set({ status: 'ready', photos }),
        error: () => this.state.set({ status: 'error' }),
      });
  }
}
