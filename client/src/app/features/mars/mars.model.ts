export interface MarsPhoto {
  id: number;
  sol: number;
  earth_date: string;
  camera: string;
  camera_abbrev: string;
  img_src: string;
  rover: string;
}

export const MARS_ROVERS = ['curiosity', 'opportunity', 'spirit'] as const;
export type MarsRover = (typeof MARS_ROVERS)[number];
