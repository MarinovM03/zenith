import { ChangeDetectionStrategy, Component, computed, inject, input } from '@angular/core';

import { AuthService } from '../../../core/services/auth.service';
import { FollowedLaunchService } from '../../../core/services/followed-launch.service';

@Component({
  selector: 'app-follow-launch-button',
  templateUrl: './follow-launch-button.html',
  styleUrl: './follow-launch-button.css',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowLaunchButton {
  private readonly followedLaunches = inject(FollowedLaunchService);
  private readonly auth = inject(AuthService);

  readonly launchId = input.required<string>();

  protected readonly signedIn = this.auth.isAuthenticated;
  protected readonly following = computed(() => this.followedLaunches.isFollowing(this.launchId()));
  protected readonly busy = computed(() => this.followedLaunches.isPending(this.launchId()));
  protected readonly error = computed(() => this.followedLaunches.mutationError(this.launchId()));

  protected toggle(): void {
    if (this.busy()) {
      return;
    }
    if (this.following()) {
      this.followedLaunches.unfollow(this.launchId());
    } else {
      this.followedLaunches.follow(this.launchId());
    }
  }
}
