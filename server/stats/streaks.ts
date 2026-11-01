import { addDays, periodBounds } from '../../shared/dates';
import type { DateStr, Period } from '../../shared/types';

/**
 * Dates on which any of `trackerIds` has an entry. A day logged by several trackers appears once.
 * An entry with value 0 ("0 minutes of tennis") is not activity.
 */
export function activeDates(
  entries: { trackerId: number; date: DateStr; value?: number }[],
  trackerIds: ReadonlySet<number>,
  /** Dates active for another reason (days with pages read, for the books area). */
  alsoActive: Iterable<DateStr> = [],
): Set<DateStr> {
  const out = new Set<DateStr>(alsoActive);
  for (const e of entries) if (trackerIds.has(e.trackerId) && e.value !== 0) out.add(e.date);
  return out;
}

/** The dates in [start, end], inclusive, ascending. */
export function datesInRange(dates: Iterable<DateStr>, start: DateStr, end: DateStr): DateStr[] {
  return [...dates].filter((d) => d >= start && d <= end).sort();
}

/** How many of `dates` fall in [start, end], inclusive. */
export function countInRange(dates: ReadonlySet<DateStr>, start: DateStr, end: DateStr): number {
  let n = 0;
  // 'YYYY-MM-DD' strings sort the same as the dates they name, so string comparison is date comparison.
  for (const d of dates) if (d >= start && d <= end) n++;
  return n;
}

/**
 * Number of consecutive periods, counting back from the current one, in which at
 * least `targetDays` of `dates` fall (spec §4).
 *
 * - The current period (the one containing `today`) is unfinished:
 *   if it already has `targetDays` active days it adds 1;
 *   if not, it is skipped — it does NOT break the streak.
 * - Every earlier period is complete: walk backward one period at a time,
 *   adding 1 for each met period, and stop at the first one that misses the target.
 *
 * Hint: the period before the one starting at `start` is
 * `periodBounds(addDays(start, -1), period)`.
 */
export function periodStreak(
  dates: ReadonlySet<DateStr>,
  period: Period,
  targetDays: number,
  today: DateStr,
): number {
  if (targetDays < 1) return 0; // every period would "meet" it, and the walk would never end
  let { start, end } = periodBounds(today, period);
  // The current period only ever adds; it is never the one that breaks the streak.
  let streak = countInRange(dates, start, end) >= targetDays ? 1 : 0;
  for (;;) {
    ({ start, end } = periodBounds(addDays(start, -1), period));
    if (countInRange(dates, start, end) < targetDays) return streak;
    streak++;
  }
}
