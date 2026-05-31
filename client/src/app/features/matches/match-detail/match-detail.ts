import { DatePipe } from '@angular/common';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  OnInit,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { ActivatedRoute, RouterLink } from '@angular/router';

import { CompetitionsService, MatchDetail } from '../../../core/services/competitions.service';
import { Crest } from '../../../shared/crest/crest';

type MatchState = { kind: 'loading' } | { kind: 'loaded'; match: MatchDetail } | { kind: 'error' };

@Component({
  selector: 'app-match-detail',
  templateUrl: './match-detail.html',
  styleUrl: './match-detail.css',
  imports: [Crest, RouterLink, DatePipe],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class MatchDetailPage implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly competitions = inject(CompetitionsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<MatchState>({ kind: 'loading' });

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
    this.competitions.match(id).subscribe({
      next: (match) => this.state.set({ kind: 'loaded', match }),
      error: () => this.state.set({ kind: 'error' }),
    });
  }
}
