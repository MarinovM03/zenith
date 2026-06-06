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
  mission: string | null;
  mission_description: string | null;
  pad: string | null;
  location: string | null;
  image: string | null;
  webcast_url: string | null;
}
