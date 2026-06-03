import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CompetitionsService, PlayerDetail } from '../../../core/services/competitions.service';
import { Crest } from '../../../shared/crest/crest';

type PlayerState =
  | { kind: 'loading' }
  | { kind: 'loaded'; player: PlayerDetail }
  | { kind: 'error' };

function ageFrom(dob: string | null): number | null {
  if (!dob) {
    return null;
  }
  const birth = new Date(dob);
  const now = new Date();
  let age = now.getFullYear() - birth.getFullYear();
  const m = now.getMonth() - birth.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) {
    age -= 1;
  }
  return age;
}

@Component({
  selector: 'app-player',
  templateUrl: './player.html',
  styleUrl: './player.css',
  imports: [Crest, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Player implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly competitions = inject(CompetitionsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<PlayerState>({ kind: 'loading' });

  protected readonly age = computed(() => {
    const current = this.state();
    return current.kind === 'loaded' ? ageFrom(current.player.date_of_birth) : null;
  });

  ngOnInit(): void {
    this.route.paramMap.pipe(takeUntilDestroyed(this.destroyRef)).subscribe((params) => {
      const id = Number(params.get('id'));
      if (id) {
        this.load(id);
      }
    });
  }

  private load(id: number): void {
    this.state.set({ kind: 'loading' });
    this.competitions.player(id).subscribe({
      next: (player) => this.state.set({ kind: 'loaded', player }),
      error: () => this.state.set({ kind: 'error' }),
    });
  }
}
