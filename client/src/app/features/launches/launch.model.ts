export interface LaunchStatus {
  name: string;
  abbrev: string;
}

export interface Launch {
  id: string;
  name: string;
  status: LaunchStatus;
  net: string;
  provider: string | null;
  rocket: string | null;
  mission_id: number | null;
  mission: string | null;
  mission_description: string | null;
  pad: string | null;
  location: string | null;
  image: string | null;
  webcast_url: string | null;
}

export type LaunchStatusTone = 'go' | 'fail' | 'hold' | 'neutral';

export function launchStatusTone(abbrev: string): LaunchStatusTone {
  const key = abbrev.toLowerCase();
  if (key === 'go' || key === 'success') return 'go';
  if (key === 'failure' || key === 'partial failure') return 'fail';
  if (key === 'hold' || key === 'tbd' || key === 'tbc') return 'hold';
  return 'neutral';
}
