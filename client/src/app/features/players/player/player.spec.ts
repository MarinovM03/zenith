import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap, provideRouter } from '@angular/router';
import { of, throwError } from 'rxjs';

import { Player } from './player';
import { CompetitionsService, PlayerDetail } from '../../../core/services/competitions.service';

const PLAYER: PlayerDetail = {
  id: 38101,
  name: 'Erling Haaland',
  first_name: 'Erling',
  last_name: 'Haaland',
  date_of_birth: '2000-07-21',
  nationality: 'Norway',
  position: 'Offence',
  shirt_number: 9,
  team_id: 65,
  team_name: 'Manchester City FC',
  team_crest: null,
};

describe('Player', () => {
  function configure(mock: Partial<CompetitionsService>) {
    TestBed.configureTestingModule({
      imports: [Player],
      providers: [
        provideRouter([]),
        { provide: CompetitionsService, useValue: mock },
        { provide: ActivatedRoute, useValue: { paramMap: of(convertToParamMap({ id: '38101' })) } },
      ],
    });
  }

  it('renders the player profile', () => {
    configure({ player: () => of(PLAYER) });
    const fixture = TestBed.createComponent(Player);
    fixture.detectChanges();
    const text = fixture.nativeElement.textContent;
    expect(text).toContain('Erling Haaland');
    expect(text).toContain('Norway');
    expect(text).toContain('Manchester City FC');
  });

  it('shows an error state on failure', () => {
    configure({ player: () => throwError(() => new Error('boom')) });
    const fixture = TestBed.createComponent(Player);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.player__status--error')).toBeTruthy();
  });
});
