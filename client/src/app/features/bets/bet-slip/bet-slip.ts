import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { Router } from '@angular/router';

import { BetSlipService } from '../../../core/services/bet-slip.service';
import { BetsService, CreateBetRequest } from '../../../core/services/bets.service';

@Component({
  selector: 'app-bet-slip',
  templateUrl: './bet-slip.html',
  styleUrl: './bet-slip.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class BetSlip {
  protected readonly slip = inject(BetSlipService);
  private readonly bets = inject(BetsService);
  private readonly router = inject(Router);

  protected readonly stake = signal('');
  protected readonly odds = signal('');
  protected readonly submitting = signal(false);
  protected readonly error = signal<string | null>(null);

  onStake(event: Event): void {
    this.stake.set((event.target as HTMLInputElement).value);
  }

  onOdds(event: Event): void {
    this.odds.set((event.target as HTMLInputElement).value);
  }

  submit(): void {
    if (this.slip.count() === 0 || this.submitting()) {
      return;
    }
    this.submitting.set(true);
    this.error.set(null);

    const request: CreateBetRequest = {
      stake: this.stake() || null,
      odds: this.odds() || null,
      legs: this.slip.selections().map((s) => s.leg),
    };

    this.bets.create(request).subscribe({
      next: () => {
        this.slip.clear();
        this.stake.set('');
        this.odds.set('');
        this.submitting.set(false);
        this.router.navigateByUrl('/bets');
      },
      error: () => {
        this.error.set('Could not log your bet. Please try again.');
        this.submitting.set(false);
      },
    });
  }
}
