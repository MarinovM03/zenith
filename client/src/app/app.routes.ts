import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    canActivate: [authGuard],
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
  },
  {
    path: 'fixtures',
    canActivate: [authGuard],
    loadComponent: () => import('./features/fixtures/fixtures').then((m) => m.Fixtures),
  },
  {
    path: 'tables',
    canActivate: [authGuard],
    loadComponent: () => import('./features/competitions/tables/tables').then((m) => m.Tables),
  },
  {
    path: 'teams/:id',
    canActivate: [authGuard],
    loadComponent: () => import('./features/teams/team/team').then((m) => m.Team),
  },
  {
    path: 'bets',
    canActivate: [authGuard],
    loadComponent: () => import('./features/bets/my-bets/my-bets').then((m) => m.MyBets),
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
