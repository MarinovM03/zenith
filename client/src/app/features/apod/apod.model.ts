export interface Apod {
  date: string;
  title: string;
  explanation: string;
  url: string;
  hdurl: string | null;
  media_type: 'image' | 'video';
  copyright: string | null;
  thumbnail_url: string | null;
}

export const APOD_EPOCH = '1995-06-16';

export function todayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function shiftDate(iso: string, deltaDays: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return d.toISOString().slice(0, 10);
}
