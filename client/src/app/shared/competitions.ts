export interface Competition {
  id: number;
  name: string;
  emblem: string;
}

const CREST = 'https://crests.football-data.org';

/**
 * The competitions available on the football-data.org free tier.
 * The backend accepts any competition id; this list drives the UI.
 */
export const COMPETITIONS: readonly Competition[] = [
  { id: 2021, name: 'Premier League', emblem: `${CREST}/PL.png` },
  { id: 2014, name: 'La Liga', emblem: `${CREST}/PD.png` },
  { id: 2019, name: 'Serie A', emblem: `${CREST}/SA.png` },
  { id: 2002, name: 'Bundesliga', emblem: `${CREST}/BL1.png` },
  { id: 2015, name: 'Ligue 1', emblem: `${CREST}/FL1.png` },
  { id: 2001, name: 'Champions League', emblem: `${CREST}/CL.png` },
  { id: 2003, name: 'Eredivisie', emblem: `${CREST}/DED.png` },
  { id: 2017, name: 'Primeira Liga', emblem: `${CREST}/PPL.png` },
  { id: 2016, name: 'Championship', emblem: `${CREST}/ELC.png` },
  { id: 2013, name: 'Brazil Série A', emblem: `${CREST}/BSA.png` },
  { id: 2152, name: 'Copa Libertadores', emblem: `${CREST}/CLI.png` },
  { id: 2000, name: 'World Cup', emblem: `${CREST}/WC.png` },
  { id: 2018, name: 'European Championship', emblem: `${CREST}/EC.png` },
];

export function competitionName(id: number): string {
  return COMPETITIONS.find((c) => c.id === id)?.name ?? 'Competition';
}

/**
 * The subset shown in the "All matches" grouped view. Capped so a cold load
 * stays within the free API's 10 requests/minute limit and never starves the
 * Tables/Teams pages. Every competition is still browsable individually.
 */
const GROUPED_IDS = [2021, 2014, 2019, 2002, 2015, 2001, 2016, 2003];

export const GROUPED_COMPETITIONS: readonly Competition[] = COMPETITIONS.filter((c) =>
  GROUPED_IDS.includes(c.id),
);
