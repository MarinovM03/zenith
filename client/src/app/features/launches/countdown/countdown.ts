import {
  ChangeDetectionStrategy,
  Component,
  computed,
  DestroyRef,
  inject,
  input,
  signal,
} from '@angular/core';

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
    const ticker = setInterval(() => this.now.set(Date.now()), 1000);
    inject(DestroyRef).onDestroy(() => clearInterval(ticker));
  }
}
