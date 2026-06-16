import { ChangeDetectionStrategy, Component, input } from '@angular/core';

@Component({
  selector: 'app-about-panel',
  templateUrl: './about-panel.html',
  styleUrl: './about-panel.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class AboutPanel {
  readonly heading = input.required<string>();
}
