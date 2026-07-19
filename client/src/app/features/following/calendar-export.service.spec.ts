import { DOCUMENT } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { TestBed } from '@angular/core/testing';

import { FollowedLaunch } from '../../core/services/followed-launch.service';
import {
  CalendarExportService,
  createLaunchCalendar,
  launchCalendarFilename,
} from './calendar-export.service';

const LAUNCH: FollowedLaunch = {
  id: 'followed-1',
  launch_id: 'launch-1',
  name: 'Artemis II, Crewed; Flyby',
  net: '2026-09-01T12:30:45Z',
  status_name: 'To Be Confirmed',
  status_abbrev: 'TBC',
  provider: 'NASA',
  image: null,
  created_at: '2026-07-19T12:00:00Z',
  updated_at: '2026-07-19T12:00:00Z',
};

describe('calendar export', () => {
  it('creates a UTC launch event with escaped text and CRLF lines', () => {
    const calendar = createLaunchCalendar(LAUNCH, new Date('2026-07-19T10:11:12Z'));

    expect(calendar).toContain('BEGIN:VCALENDAR\r\n');
    expect(calendar).toContain('DTSTAMP:20260719T101112Z\r\n');
    expect(calendar).toContain('DTSTART:20260901T123045Z\r\n');
    expect(calendar).toContain('SUMMARY:Artemis II\\, Crewed\\; Flyby\r\n');
    expect(calendar).toContain('DESCRIPTION:Provider: NASA\\nStatus: To Be Confirmed\r\n');
    expect(calendar.endsWith('END:VCALENDAR\r\n')).toBe(true);
  });

  it('creates a safe and recognisable filename', () => {
    expect(launchCalendarFilename('Ariane 6 | Mission D\u00e9mo')).toBe(
      'zenith-ariane-6-mission-demo.ics',
    );
    expect(launchCalendarFilename('***')).toBe('zenith-launch.ics');
  });

  it('rejects an invalid launch schedule', () => {
    expect(() => createLaunchCalendar({ ...LAUNCH, net: 'not-a-date' })).toThrow(
      'invalid schedule',
    );
  });

  it('downloads and cleans up the generated calendar file', () => {
    const click = vi.fn();
    const remove = vi.fn();
    const append = vi.fn();
    const createObjectURL = vi.fn().mockReturnValue('blob:launch-calendar');
    const revokeObjectURL = vi.fn();
    const link = { href: '', download: '', hidden: false, click, remove };
    const document = {
      defaultView: { Blob, URL: { createObjectURL, revokeObjectURL } },
      createElement: vi.fn().mockReturnValue(link),
      body: { append },
    };

    TestBed.configureTestingModule({
      providers: [
        CalendarExportService,
        { provide: DOCUMENT, useValue: document },
        { provide: PLATFORM_ID, useValue: 'browser' },
      ],
    });

    TestBed.inject(CalendarExportService).exportLaunch(LAUNCH);

    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob));
    expect(link).toMatchObject({
      href: 'blob:launch-calendar',
      download: 'zenith-artemis-ii-crewed-flyby.ics',
      hidden: true,
    });
    expect(append).toHaveBeenCalledWith(link);
    expect(click).toHaveBeenCalledOnce();
    expect(remove).toHaveBeenCalledOnce();
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:launch-calendar');
  });
});
