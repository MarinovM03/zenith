import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { MarsPhoto } from './mars.model';

@Injectable({ providedIn: 'root' })
export class MarsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getPhotos(rover: string, date: string, page = 1): Observable<MarsPhoto[]> {
    const params = new HttpParams().set('rover', rover).set('date', date).set('page', page);
    return this.http.get<MarsPhoto[]>(`${this.baseUrl}/mars/photos`, { params });
  }
}
