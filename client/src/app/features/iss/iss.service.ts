import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../../environments/environment';
import { IssPosition } from './iss.model';

@Injectable({ providedIn: 'root' })
export class IssService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = environment.apiBaseUrl;

  getPosition(): Observable<IssPosition> {
    return this.http.get<IssPosition>(`${this.baseUrl}/iss`);
  }
}
