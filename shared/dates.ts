import type { DateStr, Period } from './types';

// Calendar arithmetic runs on UTC midnights purely as a timezone-free calendar:
// no DST jumps, so one day is always exactly DAY_MS. Only todayLocal reads local time.
const DAY_MS = 86_400_000;

const pad = (n: number, width = 2) => String(n).padStart(width, '0');

function toUtcMs(d: DateStr): number {
  const [y, m, day] = d.split('-').map(Number);
  return Date.UTC(y, m - 1, day);
}

function fromUtcMs(ms: number): DateStr {
  const dt = new Date(ms);
  return `${pad(dt.getUTCFullYear(), 4)}-${pad(dt.getUTCMonth() + 1)}-${pad(dt.getUTCDate())}`;
}

/** Today's date in the machine's local time zone. */
export function todayLocal(now: Date = new Date()): DateStr {
  return `${pad(now.getFullYear(), 4)}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

/** True if `s` is exactly 'YYYY-MM-DD' and names a real calendar date. */
export function isDateStr(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  // Date.UTC rolls 02-30 over to 03-02; a round trip exposes that.
  return fromUtcMs(toUtcMs(s)) === s;
}

export function addDays(d: DateStr, n: number): DateStr {
  return fromUtcMs(toUtcMs(d) + n * DAY_MS);
}

/** Number of days from `a` to `b` (b − a). */
export function daysBetween(a: DateStr, b: DateStr): number {
  return Math.round((toUtcMs(b) - toUtcMs(a)) / DAY_MS);
}

/** First and last day of the week (Monday–Sunday) or calendar month containing `d`. */
export function periodBounds(d: DateStr, period: Period): { start: DateStr; end: DateStr } {
  if (period === 'week') {
    const mondayOffset = (new Date(toUtcMs(d)).getUTCDay() + 6) % 7; // Mon=0 … Sun=6
    const start = addDays(d, -mondayOffset);
    return { start, end: addDays(start, 6) };
  }
  const [y, m] = d.split('-').map(Number);
  // Day 0 of the next month is the last day of this one.
  return { start: `${pad(y, 4)}-${pad(m)}-01`, end: fromUtcMs(Date.UTC(y, m, 0)) };
}
