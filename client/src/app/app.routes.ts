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
    path: 'apod/:date',
    loadComponent: () => import('./features/apod/apod-view/apod-view').then((m) => m.ApodView),
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
