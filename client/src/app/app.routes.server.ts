import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  { path: 'apod/archive', renderMode: RenderMode.Prerender },
  { path: 'apod/:date', renderMode: RenderMode.Client },
  { path: 'launches/:id', renderMode: RenderMode.Client },
  { path: 'login', renderMode: RenderMode.Client },
  { path: 'register', renderMode: RenderMode.Client },
  { path: 'following', renderMode: RenderMode.Client },
  { path: 'favourites', renderMode: RenderMode.Client },
  { path: '**', renderMode: RenderMode.Prerender },
];
