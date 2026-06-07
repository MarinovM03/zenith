import { ChangeDetectionStrategy, Component, DestroyRef, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { ImgFade } from '../../../shared/img-fade/img-fade';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { MarsPhoto } from '../mars.model';
import { MarsService } from '../mars.service';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; photos: MarsPhoto[] }
  | { status: 'error' };

@Component({
  selector: 'app-mars-gallery',
  templateUrl: './mars-gallery.html',
  styleUrl: './mars-gallery.css',
  imports: [Skeleton, ImgFade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarsGallery {
  private readonly service = inject(MarsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<LoadState>({ status: 'loading' });
  protected readonly loadingMore = signal(false);
  protected readonly loadMoreError = signal(false);
  protected readonly noMore = signal(false);
  protected readonly skeletonSlots = Array.from({ length: 12 }, (_, i) => i);

  private page = 1;

  constructor() {
    this.reload();
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
    this.loadMoreError.set(false);
    const nextPage = this.page + 1;
    this.service
      .getPhotos(nextPage)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (more) => {
          this.page = nextPage;
          this.state.set({ status: 'ready', photos: [...current.photos, ...more] });
          this.noMore.set(more.length === 0);
          this.loadingMore.set(false);
        },
        error: () => {
          this.loadingMore.set(false);
          this.loadMoreError.set(true);
        },
      });
  }

  private reload(): void {
    this.page = 1;
    this.noMore.set(false);
    this.loadMoreError.set(false);
    this.state.set({ status: 'loading' });
    this.service
      .getPhotos(1)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (photos) => this.state.set({ status: 'ready', photos }),
        error: () => this.state.set({ status: 'error' }),
      });
  }
}
