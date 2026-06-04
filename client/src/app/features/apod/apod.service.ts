import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable, of, tap } from 'rxjs';

import { environment } from '../../../environments/environment';
import { Apod } from './apod.model';

@Injectable({ providedIn: 'root' })
export class ApodService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  private readonly byDate = new Map<string, Apod>();

  getByDate(date: string | null): Observable<Apod> {
    if (date && this.byDate.has(date)) {
      return of(this.byDate.get(date)!);
    }
    const params = date ? new HttpParams().set('date', date) : new HttpParams();
    return this.http
      .get<Apod>(`${this.baseUrl}/apod`, { params })
      .pipe(tap((apod) => this.byDate.set(apod.date, apod)));
  }

  getRange(start: string, end: string): Observable<Apod[]> {
    const params = new HttpParams().set('start', start).set('end', end);
    return this.http
      .get<Apod[]>(`${this.baseUrl}/apod/range`, { params })
      .pipe(tap((items) => items.forEach((apod) => this.byDate.set(apod.date, apod))));
  }
}
