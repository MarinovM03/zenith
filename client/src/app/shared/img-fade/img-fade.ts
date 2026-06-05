import { afterNextRender, Directive, ElementRef, inject, signal } from '@angular/core';

@Directive({
  selector: 'img[appImgFade]',
  host: { '[class.is-loaded]': 'loaded()' },
})
export class ImgFade {
  private readonly el = inject<ElementRef<HTMLImageElement>>(ElementRef);
  protected readonly loaded = signal(false);

  constructor() {
    const img = this.el.nativeElement;
    const done = () => this.loaded.set(true);
    img.addEventListener('load', done, { once: true });
    img.addEventListener('error', done, { once: true });
    afterNextRender(() => {
      if (img.complete && img.naturalWidth > 0) {
        done();
      }
    });
  }
}
