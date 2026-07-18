import { isPlatformBrowser } from '@angular/common';
import {
  ApplicationRef,
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  PLATFORM_ID,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { first } from 'rxjs';

function formatCountdown(ms: number): string {
  const totalSeconds = Math.floor(ms / 1000);
  const days = Math.floor(totalSeconds / 86400);
  const hours = Math.floor((totalSeconds % 86400) / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  const pad = (n: number) => n.toString().padStart(2, '0');
  const clock = `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
  return days > 0 ? `${days}d ${clock}` : clock;
}

@Component({
  selector: 'app-countdown',
  templateUrl: './countdown.html',
  styleUrl: './countdown.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Countdown {
  readonly target = input.required<string>();

  private readonly now = signal(Date.now());
  private readonly remaining = computed(() => new Date(this.target()).getTime() - this.now());

  protected readonly launched = computed(() => this.remaining() <= 0);
  protected readonly label = computed(() => formatCountdown(Math.max(0, this.remaining())));

  constructor() {
    const destroyRef = inject(DestroyRef);
    if (isPlatformBrowser(inject(PLATFORM_ID))) {
      inject(ApplicationRef)
        .isStable.pipe(
          first((isStable) => isStable),
          takeUntilDestroyed(destroyRef),
        )
        .subscribe(() => {
          const ticker = setInterval(() => this.now.set(Date.now()), 1000);
          destroyRef.onDestroy(() => clearInterval(ticker));
        });
    }
  }
}
