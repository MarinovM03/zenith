import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { AuthService } from '../../core/services/auth.service';
import { FavouriteService } from '../../core/services/favourite.service';

@Component({
  selector: 'app-favourite-button',
  templateUrl: './favourite-button.html',
  styleUrl: './favourite-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FavouriteButton {
  private readonly favourites = inject(FavouriteService);
  private readonly auth = inject(AuthService);

  readonly kind = input.required<string>();
  readonly refId = input.required<string>();
  readonly payload = input<Record<string, unknown>>({});

  protected readonly signedIn = this.auth.isAuthenticated;
  protected readonly isFavourite = computed(() =>
    this.favourites.isFavourite(this.kind(), this.refId()),
  );

  protected toggle(): void {
    if (this.isFavourite()) {
      this.favourites.remove(this.kind(), this.refId());
    } else {
      this.favourites.add(this.kind(), this.refId(), this.payload());
    }
  }
}
