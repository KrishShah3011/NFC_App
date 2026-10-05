import type { Event } from './types';

export const DAY = 86400000;

export const startOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(0, 0, 0, 0);
  return d.getTime();
};

/** Next local midnight (default event end, "due today" cutoff). */
export const endOfDay = (t: number) => {
  const d = new Date(t);
  d.setHours(24, 0, 0, 0);
  return d.getTime();
};

/** Monday 00:00 of t's week. */
export const startOfWeek = (t: number) => {
  const d = new Date(startOfDay(t));
  d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
  return d.getTime();
};

export const startOfMonth = (t: number) => {
  const d = new Date(startOfDay(t));
  d.setDate(1);
  return d.getTime();
};

/** The most recently started event that is running at `now`. */
export const activeEvent = (events: Event[], now: number) =>
  [...events].sort((a, b) => b.startsAt - a.startsAt).find((e) => e.startsAt <= now && now < e.endsAt);

export function relTime(t: number, now = Date.now()): string {
  const s = Math.round((now - t) / 1000);
  if (s < 60) return 'just now';
  const [n, unit] = s < 3600 ? [Math.floor(s / 60), 'minute'] : s < 86400 ? [Math.floor(s / 3600), 'hour'] : [Math.floor(s / 86400), 'day'];
  if (unit === 'day' && n > 30) return fmtDate(t);
  return `${n} ${unit}${n === 1 ? '' : 's'} ago`;
}

export const fmtDate = (t: number) => new Date(t).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
