import { isPlatformServer } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { PLATFORM_ID, inject } from '@angular/core';
import { EMPTY } from 'rxjs';

export const ssrSkipInterceptor: HttpInterceptorFn = (req, next) => {
  // During prerender there is no backend; skip outbound calls so each route serializes
  // in its loading/skeleton state and the browser re-fetches live data after hydration.
  if (isPlatformServer(inject(PLATFORM_ID))) {
    return EMPTY;
  }
  return next(req);
};
