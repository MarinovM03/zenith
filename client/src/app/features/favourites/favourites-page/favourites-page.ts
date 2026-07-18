import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import { Favourite, FavouriteService } from '../../../core/services/favourite.service';
import { ImgFade } from '../../../shared/img-fade/img-fade';

@Component({
  selector: 'app-favourites-page',
  templateUrl: './favourites-page.html',
  styleUrl: './favourites-page.css',
  imports: [RouterLink, ImgFade],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavouritesPage {
  private readonly favourites = inject(FavouriteService);

  protected readonly items = this.favourites.items;
  protected readonly loadStatus = this.favourites.loadStatus;
  protected readonly loadError = this.favourites.loadError;

  protected link(favourite: Favourite): string[] {
    if (favourite.kind === 'apod') {
      return ['/apod', favourite.ref_id];
    }
    if (favourite.kind === 'launch') {
      return ['/launches', favourite.ref_id];
    }
    return ['/'];
  }

  protected title(favourite: Favourite): string {
    const payload = favourite.payload as Record<string, string | undefined>;
    return payload['title'] ?? payload['name'] ?? favourite.ref_id;
  }

  protected image(favourite: Favourite): string | null {
    const payload = favourite.payload as Record<string, string | undefined>;
    return payload['url'] ?? payload['image'] ?? null;
  }

  protected remove(favourite: Favourite): void {
    this.favourites.remove(favourite.kind, favourite.ref_id);
  }

  protected retry(): void {
    this.favourites.load();
  }

  protected isPending(favourite: Favourite): boolean {
    return this.favourites.isPending(favourite.kind, favourite.ref_id);
  }

  protected mutationError(favourite: Favourite): string | null {
    return this.favourites.mutationError(favourite.kind, favourite.ref_id);
  }
}
