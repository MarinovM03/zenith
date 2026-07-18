import { ChangeDetectionStrategy, Component, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';

import { ImgFade } from '../../../shared/img-fade/img-fade';

export type DashboardCardVariant = 'launch' | 'asteroids' | 'mars' | 'iss';

@Component({
  selector: 'app-dashboard-card',
  templateUrl: './dashboard-card.html',
  styleUrl: './dashboard-card.css',
  imports: [RouterLink, ImgFade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardCard {
  readonly title = input.required<string>();
  readonly route = input.required<string>();
  readonly variant = input.required<DashboardCardVariant>();
  readonly error = input(false);
  readonly backgroundImage = input<string | null>(null);
  readonly backgroundAlt = input('');

  readonly retry = output<void>();
}
