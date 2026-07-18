import { DatePipe } from '@angular/common';
import {
  afterNextRender,
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  input,
  output,
  viewChild,
} from '@angular/core';

import { MarsPhoto } from '../mars.model';

@Component({
  selector: 'app-mars-photo-viewer',
  templateUrl: './mars-photo-viewer.html',
  styleUrl: './mars-photo-viewer.css',
  imports: [DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MarsPhotoViewer {
  readonly photo = input.required<MarsPhoto>();
  readonly position = input.required<number>();
  readonly total = input.required<number>();
  readonly hasPrevious = input(false);
  readonly hasNext = input(false);

  readonly closed = output<void>();
  readonly previous = output<void>();
  readonly next = output<void>();

  private readonly dialog = viewChild.required<ElementRef<HTMLDialogElement>>('dialog');

  constructor() {
    afterNextRender(() => {
      const dialog = this.dialog().nativeElement;
      if (typeof dialog.showModal === 'function') {
        dialog.showModal();
      } else {
        dialog.setAttribute('open', '');
      }
    });
  }

  protected cameraLabel(camera: string): string {
    return camera.replaceAll('_', ' ');
  }

  protected onCancel(event: Event): void {
    event.preventDefault();
    this.closeViewer();
  }

  protected onBackdropClick(event: MouseEvent): void {
    if (event.target === this.dialog().nativeElement) {
      this.closeViewer();
    }
  }

  protected closeViewer(): void {
    const dialog = this.dialog().nativeElement;
    if (dialog.open && typeof dialog.close === 'function') {
      dialog.close();
    } else {
      dialog.removeAttribute('open');
    }
    this.closed.emit();
  }

  protected onPrevious(event: Event): void {
    event.preventDefault();
    if (this.hasPrevious()) {
      this.previous.emit();
    }
  }

  protected onNext(event: Event): void {
    event.preventDefault();
    if (this.hasNext()) {
      this.next.emit();
    }
  }
}
