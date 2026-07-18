import {
  HttpErrorResponse,
  HttpHandlerFn,
  HttpInterceptorFn,
  HttpRequest,
} from '@angular/common/http';
import { inject } from '@angular/core';
import { catchError, switchMap, throwError } from 'rxjs';

import { environment } from '../../../environments/environment';
import { AuthService } from '../services/auth.service';

const SESSION_ENDPOINTS = ['/auth/login', '/auth/register', '/auth/refresh', '/auth/logout'];

function isApiRequest(url: string): boolean {
  const baseUrl = environment.apiBaseUrl.replace(/\/$/, '');
  return url === baseUrl || url.startsWith(`${baseUrl}/`);
}

function isSessionRequest(url: string): boolean {
  const path = url.split(/[?#]/, 1)[0];
  return SESSION_ENDPOINTS.some((endpoint) => path.endsWith(endpoint));
}

function withAccessToken(req: HttpRequest<unknown>, token: string): HttpRequest<unknown> {
  return req.clone({ setHeaders: { Authorization: `Bearer ${token}` } });
}

function retryWithToken(
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  auth: AuthService,
  token: string,
) {
  return next(withAccessToken(req, token)).pipe(
    catchError((error: unknown) => {
      if (error instanceof HttpErrorResponse && error.status === 401) {
        auth.clearSession();
      }
      return throwError(() => error);
    }),
  );
}

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const auth = inject(AuthService);
  const token = auth.accessToken();
  if (!token || !isApiRequest(req.url) || isSessionRequest(req.url)) {
    return next(req);
  }

  return next(withAccessToken(req, token)).pipe(
    catchError((error: unknown) => {
      if (!(error instanceof HttpErrorResponse) || error.status !== 401) {
        return throwError(() => error);
      }

      const currentToken = auth.accessToken();
      if (!currentToken) {
        return throwError(() => error);
      }
      if (currentToken !== token) {
        return retryWithToken(req, next, auth, currentToken);
      }

      return auth.refresh().pipe(
        catchError((refreshError: unknown) => {
          auth.clearSession();
          return throwError(() => refreshError);
        }),
        switchMap((response) => retryWithToken(req, next, auth, response.access_token)),
      );
    }),
  );
};
