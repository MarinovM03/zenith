import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-skeleton',
  template: '',
  styleUrl: './skeleton.css',
  host: {
    '[style.width]': 'width()',
    '[style.height]': 'height()',
    '[style.borderRadius]': 'radius()',
  },
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Skeleton {
  readonly width = input('100%');
  readonly height = input('1rem');
  readonly radius = input('var(--radius-md)');
}
