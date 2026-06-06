import { HttpClient, HttpParams } from '@angular/common/http';
import { computed, effect, inject, Injectable, signal } from '@angular/core';

import { environment } from '../../../environments/environment';
import { AuthService } from './auth.service';

export interface Favourite {
  id: string;
  kind: string;
  ref_id: string;
  payload: Record<string, unknown>;
  created_at: string;
}

@Injectable({ providedIn: 'root' })
export class FavouriteService {
  private readonly http = inject(HttpClient);
  private readonly auth = inject(AuthService);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly _items = signal<Favourite[]>([]);
  readonly items = this._items.asReadonly();

  private readonly keys = computed(
    () => new Set(this._items().map((f) => `${f.kind}:${f.ref_id}`)),
  );

  constructor() {
    effect(() => {
      if (this.auth.isAuthenticated()) {
        this.load();
      } else {
        this._items.set([]);
      }
    });
  }

  isFavourite(kind: string, refId: string): boolean {
    return this.keys().has(`${kind}:${refId}`);
  }

  load(): void {
    this.http.get<Favourite[]>(`${this.baseUrl}/favourites`).subscribe({
      next: (items) => this._items.set(items),
      error: () => this._items.set([]),
    });
  }

  add(kind: string, refId: string, payload: Record<string, unknown>): void {
    this.http
      .post<Favourite>(`${this.baseUrl}/favourites`, { kind, ref_id: refId, payload })
      .subscribe({
        next: (favourite) =>
          this._items.update((items) => [
            favourite,
            ...items.filter((f) => !(f.kind === kind && f.ref_id === refId)),
          ]),
      });
  }

  remove(kind: string, refId: string): void {
    const params = new HttpParams().set('kind', kind).set('ref_id', refId);
    this.http.delete(`${this.baseUrl}/favourites`, { params }).subscribe({
      next: () =>
        this._items.update((items) =>
          items.filter((f) => !(f.kind === kind && f.ref_id === refId)),
        ),
    });
  }
}
