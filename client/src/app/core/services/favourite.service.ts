import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';
import { finalize } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface Favourite {
  id: string;
  kind: string;
  ref_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

export type FavouriteLoadStatus = 'idle' | 'loading' | 'loaded' | 'error';

const LOAD_ERROR = "We couldn't load your favourites. Try again.";

@Injectable({ providedIn: 'root' })
export class FavouriteService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly _items = signal<Favourite[]>([]);
  readonly items = this._items.asReadonly();

  private readonly _loadStatus = signal<FavouriteLoadStatus>('idle');
  readonly loadStatus = this._loadStatus.asReadonly();

  private readonly _loadError = signal<string | null>(null);
  readonly loadError = this._loadError.asReadonly();

  private readonly pendingKeys = signal<ReadonlySet<string>>(new Set());
  private readonly mutationErrors = signal<ReadonlyMap<string, string>>(new Map());

  private readonly keys = computed(
    () => new Set(this._items().map((f) => `${f.kind}:${f.ref_id}`)),
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

  isFavourite(kind: string, refId: string): boolean {
    return this.keys().has(this.key(kind, refId));
  }

  isPending(kind: string, refId: string): boolean {
    return this.pendingKeys().has(this.key(kind, refId));
  }

  mutationError(kind: string, refId: string): string | null {
    return this.mutationErrors().get(this.key(kind, refId)) ?? null;
  }

  load(): void {
    this._loadStatus.set('loading');
    this._loadError.set(null);
    this.http.get<Favourite[]>(`${this.baseUrl}/favourites`).subscribe({
      next: (items) => {
        this._items.set(items);
        this._loadStatus.set('loaded');
      },
      error: () => {
        this._loadStatus.set('error');
        this._loadError.set(LOAD_ERROR);
      },
    });
  }

  add(kind: string, refId: string, payload: Record<string, unknown>): void {
    const key = this.key(kind, refId);
    if (this.pendingKeys().has(key)) {
      return;
    }
    this.startMutation(key);
    this.http
      .post<Favourite>(`${this.baseUrl}/favourites`, { kind, ref_id: refId, payload })
      .pipe(finalize(() => this.finishMutation(key)))
      .subscribe({
        next: (favourite) =>
          this._items.update((items) => [
            favourite,
            ...items.filter((f) => !(f.kind === kind && f.ref_id === refId)),
          ]),
        error: () => this.setMutationError(key, "We couldn't save this favourite. Try again."),
      });
  }

  remove(kind: string, refId: string): void {
    const key = this.key(kind, refId);
    if (this.pendingKeys().has(key)) {
      return;
    }
    this.startMutation(key);
    const params = new HttpParams().set('kind', kind).set('ref_id', refId);
    this.http
      .delete(`${this.baseUrl}/favourites`, { params })
      .pipe(finalize(() => this.finishMutation(key)))
      .subscribe({
        next: () =>
          this._items.update((items) =>
            items.filter((f) => !(f.kind === kind && f.ref_id === refId)),
          ),
        error: () => this.setMutationError(key, "We couldn't remove this favourite. Try again."),
      });
  }

  private key(kind: string, refId: string): string {
    return `${kind}:${refId}`;
  }

  private startMutation(key: string): void {
    this.pendingKeys.update((keys) => new Set(keys).add(key));
    this.mutationErrors.update((errors) => {
      const next = new Map(errors);
      next.delete(key);
      return next;
    });
  }

  private finishMutation(key: string): void {
    this.pendingKeys.update((keys) => {
      const next = new Set(keys);
      next.delete(key);
      return next;
    });
  }

  private setMutationError(key: string, message: string): void {
    this.mutationErrors.update((errors) => new Map(errors).set(key, message));
  }

  private reset(): void {
    this._items.set([]);
    this._loadStatus.set('idle');
    this._loadError.set(null);
    this.pendingKeys.set(new Set());
    this.mutationErrors.set(new Map());
  }
}
