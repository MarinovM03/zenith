import { HttpClient } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface FollowedLaunch {
  id: string;
  launch_id: string;
  name: string;
  net: string;
  status_name: string;
  status_abbrev: string;
  provider: string | null;
  image: string | null;
  created_at: string;
  updated_at: string;
}

export type FollowedLaunchLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

const LOAD_ERROR = "We couldn't load your followed launches. Try again.";

@Injectable({ providedIn: 'root' })
export class FollowedLaunchService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly _items = signal<FollowedLaunch[]>([]);
  readonly items = this._items.asReadonly();

  private readonly _loadStatus = signal<FollowedLaunchLoadStatus>('idle');
  readonly loadStatus = this._loadStatus.asReadonly();

  private readonly _loadError = signal<string | null>(null);
  readonly loadError = this._loadError.asReadonly();

  private readonly pendingIds = signal<ReadonlySet<string>>(new Set());
  private readonly mutationErrors = signal<ReadonlyMap<string, string>>(new Map());
  private readonly followedIds = computed(
    () => new Set(this._items().map((item) => item.launch_id)),
  );

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.load();
      } else {
        this.reset();
      }
    });
  }

  isFollowing(launchId: string): boolean {
    return this.followedIds().has(launchId);
  }

  isPending(launchId: string): boolean {
    return this.pendingIds().has(launchId);
  }

  mutationError(launchId: string): string | null {
    return this.mutationErrors().get(launchId) ?? null;
  }

  load(): void {
    this._loadStatus.set('loading');
    this._loadError.set(null);
    this.http.get<FollowedLaunch[]>(`${this.baseUrl}/followed-launches`).subscribe({
      next: (items) => {
        this._items.set(this.sort(items));
        this._loadStatus.set('loaded');
      },
      error: () => {
        this._loadStatus.set('error');
        this._loadError.set(LOAD_ERROR);
      },
    });
  }

  follow(launchId: string): void {
    if (this.pendingIds().has(launchId)) {
      return;
    }
    this.startMutation(launchId);
    this.http
      .put<FollowedLaunch>(`${this.baseUrl}/followed-launches/${launchId}`, null)
      .pipe(finalize(() => this.finishMutation(launchId)))
      .subscribe({
        next: (followed) =>
          this._items.update((items) =>
            this.sort([...items.filter((item) => item.launch_id !== followed.launch_id), followed]),
          ),
        error: () => this.setMutationError(launchId, "We couldn't follow this launch. Try again."),
      });
  }

  unfollow(launchId: string): void {
    if (this.pendingIds().has(launchId)) {
      return;
    }
    this.startMutation(launchId);
    this.http
      .delete(`${this.baseUrl}/followed-launches/${launchId}`)
      .pipe(finalize(() => this.finishMutation(launchId)))
      .subscribe({
        next: () =>
          this._items.update((items) => items.filter((item) => item.launch_id !== launchId)),
        error: () =>
          this.setMutationError(launchId, "We couldn't unfollow this launch. Try again."),
      });
  }

  private sort(items: FollowedLaunch[]): FollowedLaunch[] {
    return [...items].sort((a, b) => Date.parse(a.net) - Date.parse(b.net));
  }

  private startMutation(launchId: string): void {
    this.pendingIds.update((ids) => new Set(ids).add(launchId));
    this.mutationErrors.update((errors) => {
      const next = new Map(errors);
      next.delete(launchId);
      return next;
    });
  }

  private finishMutation(launchId: string): void {
    this.pendingIds.update((ids) => {
      const next = new Set(ids);
      next.delete(launchId);
      return next;
    });
  }

  private setMutationError(launchId: string, message: string): void {
    this.mutationErrors.update((errors) => new Map(errors).set(launchId, message));
  }

  private reset(): void {
    this._items.set([]);
    this._loadStatus.set('idle');
    this._loadError.set(null);
    this.pendingIds.set(new Set());
    this.mutationErrors.set(new Map());
  }
}
