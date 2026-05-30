import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Team } from './team';
import { CompetitionsService, TeamDetail } from '../../../core/services/competitions.service';

const TEAM: TeamDetail = {
  id: 57,
  name: 'Arsenal FC',
  crest: null,
  country: 'England',
  founded: 1886,
  club_colors: 'Red / White',
  venue: 'Emirates Stadium',
  website: null,
  coach_name: 'Mikel Arteta',
  squad: [
    {
      id: 1,
      name: 'Kepa',
      position: 'Goalkeeper',
      date_of_birth: '1994-10-03',
      nationality: 'Spain',
    },
    { id: 2, name: 'Saka', position: 'Right Winger', date_of_birth: null, nationality: 'England' },
  ],
};

describe('Team', () => {
  function configure(mock: Partial<CompetitionsService>) {
    TestBed.configureTestingModule({
      imports: [Team],
      providers: [
        provideRouter([]),
        { provide: CompetitionsService, useValue: mock },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '57' })) } },
      ],
    });
  }

  it('renders team info and the grouped squad', () => {
    configure({ team: () => of(TEAM) });
    const fixture = TestBed.createComponent(Team);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Arsenal FC');
    expect(text).toContain('Mikel Arteta');
    expect(text).toContain('Goalkeepers');
    expect(text).toContain('Forwards');
    expect(text).toContain('Kepa');
  });

  it('shows an error state when the team fails to load', () => {
    configure({ team: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(Team);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.team__status--error')).toBeTruthy();
  });
});
