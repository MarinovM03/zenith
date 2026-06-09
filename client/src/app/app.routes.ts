import { Routes } from '@angular/router';

import { authGuard, guestGuard } from './core/guards/auth.guard';

export const routes: Routes = [
  {
    path: '',
    pathMatch: 'full',
    loadComponent: () => import('./features/home/home').then((m) => m.Home),
    data: {
      description:
        "Explore space with Zenith — NASA's daily picture, live rocket launches, Mars rover " +
        'photos, near-Earth asteroids, and a live ISS tracker.',
    },
  },
  {
    path: 'apod',
    pathMatch: 'full',
    title: 'Picture of the Day',
    loadComponent: () => import('./features/apod/apod-view/apod-view').then((m) => m.ApodView),
    data: { description: "NASA's Astronomy Picture of the Day — today's image and its story." },
  },
  {
    path: 'apod/archive',
    pathMatch: 'full',
    title: 'Picture Archive',
    loadComponent: () =>
      import('./features/apod/apod-gallery/apod-gallery').then((m) => m.ApodGallery),
    data: { description: 'Browse past NASA Astronomy Pictures of the Day by date.' },
  },
  {
    path: 'apod/:date',
    title: 'Picture of the Day',
    loadComponent: () => import('./features/apod/apod-view/apod-view').then((m) => m.ApodView),
    data: { description: 'A NASA Astronomy Picture of the Day with its full explanation.' },
  },
  {
    path: 'launches',
    pathMatch: 'full',
    title: 'Rocket Launches',
    loadComponent: () =>
      import('./features/launches/launches-list/launches-list').then((m) => m.LaunchesList),
    data: {
      description:
        'Upcoming and recent rocket launches across all providers, with live countdowns.',
    },
  },
  {
    path: 'launches/:id',
    title: 'Launch Detail',
    loadComponent: () =>
      import('./features/launches/launch-detail/launch-detail').then((m) => m.LaunchDetail),
    data: { description: 'Details and a live countdown for this rocket launch.' },
  },
  {
    path: 'mars',
    pathMatch: 'full',
    title: 'Mars Rover Photos',
    loadComponent: () =>
      import('./features/mars/mars-gallery/mars-gallery').then((m) => m.MarsGallery),
    data: { description: "The latest raw images from NASA's Perseverance rover on Mars." },
  },
  {
    path: 'asteroids',
    pathMatch: 'full',
    title: 'Near-Earth Asteroids',
    loadComponent: () =>
      import('./features/asteroids/asteroids-list/asteroids-list').then((m) => m.AsteroidsList),
    data: {
      description: 'Near-Earth asteroids approaching over the next 7 days, hazardous ones flagged.',
    },
  },
  {
    path: 'iss',
    pathMatch: 'full',
    title: 'Live ISS Tracker',
    loadComponent: () => import('./features/iss/iss-tracker/iss-tracker').then((m) => m.IssTracker),
    data: {
      description:
        'Track the International Space Station live — position, altitude, speed, and day/night side.',
    },
  },
  {
    path: 'favourites',
    pathMatch: 'full',
    title: 'Favourites',
    canActivate: [authGuard],
    loadComponent: () =>
      import('./features/favourites/favourites-page/favourites-page').then((m) => m.FavouritesPage),
    data: { description: 'Your saved pictures and launches.' },
  },
  {
    path: 'login',
    title: 'Log in',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login/login').then((m) => m.Login),
    data: { description: 'Sign in to your Zenith account.' },
  },
  {
    path: 'register',
    title: 'Sign up',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/register/register').then((m) => m.Register),
    data: { description: 'Create a Zenith account to save your favourites.' },
  },
  {
    path: '**',
    title: 'Page not found',
    loadComponent: () => import('./features/not-found/not-found').then((m) => m.NotFound),
    data: { description: 'This page drifted off into space.' },
  },
];
