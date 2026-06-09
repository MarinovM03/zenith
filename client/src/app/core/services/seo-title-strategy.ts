import { Injectable, inject } from '@angular/core';
import { Meta, Title } from '@angular/platform-browser';
import { RouterStateSnapshot, TitleStrategy } from '@angular/router';

const SITE_NAME = 'Zenith';
const DEFAULT_TITLE = 'Zenith — Space Explorer';
const DEFAULT_DESCRIPTION =
  "Explore space with Zenith — NASA's daily picture, live rocket launches, Mars rover " +
  'photos, near-Earth asteroids, and a live ISS tracker.';

@Injectable({ providedIn: 'root' })
export class SeoTitleStrategy extends TitleStrategy {
  private readonly title = inject(Title);
  private readonly meta = inject(Meta);

  override updateTitle(snapshot: RouterStateSnapshot): void {
    const routeTitle = this.buildTitle(snapshot);
    const fullTitle = routeTitle ? `${routeTitle} · ${SITE_NAME}` : DEFAULT_TITLE;
    const description = this.routeDescription(snapshot);

    this.title.setTitle(fullTitle);
    this.meta.updateTag({ name: 'description', content: description });
    this.meta.updateTag({ property: 'og:title', content: fullTitle });
    this.meta.updateTag({ property: 'og:description', content: description });
    this.meta.updateTag({ name: 'twitter:title', content: fullTitle });
    this.meta.updateTag({ name: 'twitter:description', content: description });
  }

  private routeDescription(snapshot: RouterStateSnapshot): string {
    let route = snapshot.root;
    while (route.firstChild) {
      route = route.firstChild;
    }
    const description = route.data['description'];
    return typeof description === 'string' ? description : DEFAULT_DESCRIPTION;
  }
}
