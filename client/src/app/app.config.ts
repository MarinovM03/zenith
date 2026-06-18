import {
  ApplicationConfig,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
  provideZonelessChangeDetection,
  inject,
} from '@angular/core';
import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import { TitleStrategy, provideRouter, withViewTransitions } from '@angular/router';

import { routes } from './app.routes';
import { authInterceptor } from './core/interceptors/auth.interceptor';
import { ssrSkipInterceptor } from './core/interceptors/ssr-skip.interceptor';
import { AuthService } from './core/services/auth.service';
import { SeoTitleStrategy } from './core/services/seo-title-strategy';
import { provideClientHydration, withEventReplay } from '@angular/platform-browser';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideZonelessChangeDetection(),
    provideHttpClient(withFetch(), withInterceptors([ssrSkipInterceptor, authInterceptor])),
    provideRouter(routes, withViewTransitions({ skipInitialTransition: true })),
    { provide: TitleStrategy, useClass: SeoTitleStrategy },
    provideAppInitializer(() => {
      inject(AuthService).initialize().subscribe();
    }),
    provideClientHydration(withEventReplay()),
  ],
};
