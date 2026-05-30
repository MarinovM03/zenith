import { Injectable, computed, signal } from '@angular/core';

import { CreateLeg } from './bets.service';

export interface Selection {
  key: string;
  fixtureId: number;
  matchLabel: string;
  label: string;
  leg: CreateLeg;
}

@Injectable({ providedIn: 'root' })
export class BetSlipService {
  private readonly _selections = signal<Selection[]>([]);

  readonly selections = this._selections.asReadonly();
  readonly count = computed(() => this._selections().length);

  has(key: string): boolean {
    return this._selections().some((s) => s.key === key);
  }

  toggle(selection: Selection): void {
    if (this.has(selection.key)) {
      this.remove(selection.key);
    } else {
      this._selections.update((list) => [...list, selection]);
    }
  }

  remove(key: string): void {
    this._selections.update((list) => list.filter((s) => s.key !== key));
  }

  clear(): void {
    this._selections.set([]);
  }
}
