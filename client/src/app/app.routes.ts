import { Routes } from '@angular/router';

import { guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'apod',
    pathMatch: 'full',
    loadComponent: () => import('./features/apod/apod-view/apod-view').then((m) => m.ApodView),
  },
  {
    path: 'apod/archive',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/apod/apod-gallery/apod-gallery').then((m) => m.ApodGallery),
  },
  {
    path: 'apod/:date',
    loadComponent: () => import('./features/apod/apod-view/apod-view').then((m) => m.ApodView),
  },
  {
    path: 'launches',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/launches/launches-list/launches-list').then((m) => m.LaunchesList),
  },
  {
    path: 'launches/:id',
    loadComponent: () =>
      import('./features/launches/launch-detail/launch-detail').then((m) => m.LaunchDetail),
  },
  {
    path: 'mars',
    pathMatch: 'full',
    loadComponent: () =>
      import('./features/mars/mars-gallery/mars-gallery').then((m) => m.MarsGallery),
  },
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
  },
  {
    path: 'register',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
  },
  { path: '**', redirectTo: '' },
];
