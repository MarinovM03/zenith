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

import {
  CompetitionsService,
  SquadPlayer,
  TeamDetail,
} from '../../../core/services/competitions.service';
import { Crest } from '../../../shared/crest/crest';

interface SquadGroup {
  name: string;
  players: SquadPlayer[];
}

type TeamState = { kind: 'loading' } | { kind: 'loaded'; team: TeamDetail } | { kind: 'error' };

const GROUP_ORDER = ['Goalkeepers', 'Defenders', 'Midfielders', 'Forwards', 'Other'];

function groupFor(position: string | null): string {
  const p = (position ?? '').toLowerCase();
  if (p.includes('goalkeeper')) return 'Goalkeepers';
  if (p.includes('back') || p.includes('defence') || p.includes('defender')) return 'Defenders';
  if (p.includes('midfield')) return 'Midfielders';
  if (
    p.includes('forward') ||
    p.includes('winger') ||
    p.includes('striker') ||
    p.includes('offence') ||
    p.includes('attack')
  ) {
    return 'Forwards';
  }
  return 'Other';
}

@Component({
  selector: 'app-team',
  templateUrl: './team.html',
  styleUrl: './team.css',
  imports: [Crest, RouterLink],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Team implements OnInit {
  private readonly route = inject(ActivatedRoute);
  private readonly competitions = inject(CompetitionsService);
  private readonly destroyRef = inject(DestroyRef);

  protected readonly state = signal<TeamState>({ kind: 'loading' });

  protected readonly squadGroups = computed<SquadGroup[]>(() => {
    const current = this.state();
    if (current.kind !== 'loaded') {
      return [];
    }
    const buckets = new Map<string, SquadPlayer[]>();
    for (const player of current.team.squad) {
      const key = groupFor(player.position);
      const list = buckets.get(key) ?? [];
      list.push(player);
      buckets.set(key, list);
    }
    return GROUP_ORDER.filter((name) => buckets.has(name)).map((name) => ({
      name,
      players: buckets.get(name) ?? [],
    }));
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
    this.competitions.team(id).subscribe({
      next: (team) => this.state.set({ kind: 'loaded', team }),
      error: () => this.state.set({ kind: 'error' }),
    });
  }
}
