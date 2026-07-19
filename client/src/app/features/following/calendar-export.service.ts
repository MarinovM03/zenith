import { DOCUMENT, isPlatformBrowser } from '@angular/common';
import { Injectable, PLATFORM_ID, inject } from '@angular/core';

import { FollowedLaunch } from '../../core/services/followed-launch.service';

const CALENDAR_LINE_LIMIT = 75;

function escapeCalendarText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/,/g, '\\,')
    .replace(/;/g, '\\;');
}

function formatCalendarDate(value: string | Date): string {
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) {
    throw new Error('Cannot export a launch with an invalid schedule.');
  }
  return date
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '');
}

function foldCalendarLine(line: string): string {
  if (line.length <= CALENDAR_LINE_LIMIT) {
    return line;
  }

  const chunks = [line.slice(0, CALENDAR_LINE_LIMIT)];
  for (let offset = CALENDAR_LINE_LIMIT; offset < line.length; offset += CALENDAR_LINE_LIMIT - 1) {
    chunks.push(` ${line.slice(offset, offset + CALENDAR_LINE_LIMIT - 1)}`);
  }
  return chunks.join('\r\n');
}

export function createLaunchCalendar(launch: FollowedLaunch, generatedAt = new Date()): string {
  const provider = launch.provider ?? 'Unknown provider';
  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Zenith//Launch Calendar//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${escapeCalendarText(launch.launch_id)}@zenith`,
    `DTSTAMP:${formatCalendarDate(generatedAt)}`,
    `DTSTART:${formatCalendarDate(launch.net)}`,
    `SUMMARY:${escapeCalendarText(launch.name)}`,
    `DESCRIPTION:${escapeCalendarText(`Provider: ${provider}\nStatus: ${launch.status_name}`)}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ];

  return `${lines.map(foldCalendarLine).join('\r\n')}\r\n`;
}

export function launchCalendarFilename(name: string): string {
  const slug = name
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 60);
  return `zenith-${slug || 'launch'}.ics`;
}

@Injectable({ providedIn: 'root' })
export class CalendarExportService {
  private readonly document = inject(DOCUMENT);
  private readonly platformId = inject(PLATFORM_ID);

  exportLaunch(launch: FollowedLaunch): void {
    if (!isPlatformBrowser(this.platformId)) {
      return;
    }

    const view = this.document.defaultView;
    if (!view) {
      return;
    }

    const blob = new view.Blob([createLaunchCalendar(launch)], {
      type: 'text/calendar;charset=utf-8',
    });
    const objectUrl = view.URL.createObjectURL(blob);
    const link = this.document.createElement('a');
    link.href = objectUrl;
    link.download = launchCalendarFilename(launch.name);
    link.hidden = true;
    this.document.body.append(link);

    try {
      link.click();
    } finally {
      link.remove();
      view.URL.revokeObjectURL(objectUrl);
    }
  }
}
