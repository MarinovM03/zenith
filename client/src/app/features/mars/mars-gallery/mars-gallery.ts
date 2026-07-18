import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';

import { AboutPanel } from '../../../shared/about-panel/about-panel';
import { ImgFade } from '../../../shared/img-fade/img-fade';
import { Skeleton } from '../../../shared/skeleton/skeleton';
import { MarsPhoto } from '../mars.model';
import { MarsPhotoViewer } from '../mars-photo-viewer/mars-photo-viewer';
import { MarsService } from '../mars.service';

type LoadState =
  | { status: 'loading' }
  | { status: 'ready'; photos: MarsPhoto[] }
  | { status: 'error' };

@Component({
  selector: 'app-mars-gallery',
  templateUrl: './mars-gallery.html',
  styleUrl: './mars-gallery.css',
  imports: [DatePipe, Skeleton, ImgFade, AboutPanel, MarsPhotoViewer],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarsGallery {
  private readonly service = inject(MarsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<LoadState>({ status: 'loading' });
  protected readonly loadingMore = signal(false);
  protected readonly loadMoreError = signal(false);
  protected readonly noMore = signal(false);
  protected readonly camera = signal('');
  protected readonly selectedPhoto = signal<MarsPhoto | null>(null);
  protected readonly skeletonSlots = Array.from({ length: 12 }, (_, i) => i);

  protected readonly cameras = computed(() => {
    const current = this.state();
    if (current.status !== 'ready') {
      return [];
    }
    return [...new Set(current.photos.map((photo) => photo.camera))].sort((a, b) =>
      a.localeCompare(b),
    );
  });

  protected readonly filteredPhotos = computed(() => {
    const current = this.state();
    if (current.status !== 'ready') {
      return [];
    }
    const camera = this.camera();
    return camera ? current.photos.filter((photo) => photo.camera === camera) : current.photos;
  });

  protected readonly selectedIndex = computed(() => {
    const selected = this.selectedPhoto();
    return selected ? this.filteredPhotos().findIndex((photo) => photo.id === selected.id) : -1;
  });

  protected readonly hasPreviousPhoto = computed(() => this.selectedIndex() > 0);
  protected readonly hasNextPhoto = computed(() => {
    const index = this.selectedIndex();
    return index >= 0 && index < this.filteredPhotos().length - 1;
  });

  private page = 1;

  constructor() {
    this.reload();
  }

  protected retry(): void {
    this.reload();
  }

  protected onCameraChange(event: Event): void {
    this.closePhoto();
    this.camera.set((event.target as HTMLSelectElement).value);
  }

  protected clearCamera(): void {
    this.closePhoto();
    this.camera.set('');
  }

  protected openPhoto(photo: MarsPhoto): void {
    this.selectedPhoto.set(photo);
  }

  protected closePhoto(): void {
    this.selectedPhoto.set(null);
  }

  protected showPreviousPhoto(): void {
    const index = this.selectedIndex();
    if (index > 0) {
      this.selectedPhoto.set(this.filteredPhotos()[index - 1]);
    }
  }

  protected showNextPhoto(): void {
    const index = this.selectedIndex();
    const photos = this.filteredPhotos();
    if (index >= 0 && index < photos.length - 1) {
      this.selectedPhoto.set(photos[index + 1]);
    }
  }

  protected cameraLabel(camera: string): string {
    return camera.replaceAll('_', ' ');
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
    this.closePhoto();
    this.camera.set('');
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
