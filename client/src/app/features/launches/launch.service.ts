import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Launch } from './launch.model';

@Injectable({ providedIn: 'root' })
export class LaunchService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly byId = new Map<string, Launch>();

  getUpcoming(limit = 12): Observable<Launch[]> {
    return this.http
      .get<Launch[]>(`${this.baseUrl}/launches/upcoming`, {
        params: new HttpParams().set('limit', limit),
      })
      .pipe(tap((items) => this.cache(items)));
  }

  getPrevious(limit = 12): Observable<Launch[]> {
    return this.http
      .get<Launch[]>(`${this.baseUrl}/launches/previous`, {
        params: new HttpParams().set('limit', limit),
      })
      .pipe(tap((items) => this.cache(items)));
  }

  getById(id: string): Observable<Launch> {
    const cached = this.byId.get(id);
    if (cached) {
      return of(cached);
    }
    return this.http
      .get<Launch>(`${this.baseUrl}/launches/${id}`)
      .pipe(tap((launch) => this.byId.set(launch.id, launch)));
  }

  private cache(items: Launch[]): void {
    items.forEach((launch) => this.byId.set(launch.id, launch));
  }
}
