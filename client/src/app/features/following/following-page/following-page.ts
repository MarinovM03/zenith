import { DatePipe } from '@angular/common';
import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { RouterLink } from '@angular/router';

import {
  FollowedLaunch,
  FollowedLaunchService,
} from '../../../core/services/followed-launch.service';
import { ImgFade } from '../../../shared/img-fade/img-fade';
import { Countdown } from '../../launches/countdown/countdown';
import { FollowLaunchButton } from '../../launches/follow-launch-button/follow-launch-button';
import { CalendarExportService } from '../calendar-export.service';

@Component({
  selector: 'app-following-page',
  templateUrl: './following-page.html',
  styleUrl: './following-page.css',
  imports: [RouterLink, DatePipe, ImgFade, Countdown, FollowLaunchButton],
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FollowingPage {
  private readonly followedLaunches = inject(FollowedLaunchService);
  private readonly calendarExport = inject(CalendarExportService);

  protected readonly items = this.followedLaunches.items;
  protected readonly loadStatus = this.followedLaunches.loadStatus;
  protected readonly loadError = this.followedLaunches.loadError;

  protected retry(): void {
    this.followedLaunches.load();
  }

  protected exportCalendar(launch: FollowedLaunch): void {
    this.calendarExport.exportLaunch(launch);
  }
}
