import { periodBounds } from '../../shared/dates';
import { minutesFactor } from '../../shared/subjects';
import type { DateStr, Kind, Period } from '../../shared/types';
import { bucketStarts } from './buckets';

/**
 * Time in minutes per tracker per bucket overlapping [from, to], zero-filled; only days inside the range count.
 * Trackers that don't count toward time (see `minutesFactor`) are left out. Rows follow tracker order, then bucket.
 */
export function minutesPerBucket(
  trackers: { id: number; kind: Kind; unit: string | null; minutesPerUnit: number | null }[],
  entries: { trackerId: number; date: DateStr; value: number }[],
  from: DateStr,
  to: DateStr,
  bucket: Period,
): { trackerId: number; periodStart: DateStr; minutes: number }[] {
  const factors = new Map<number, number>();
  for (const t of trackers) {
    const f = minutesFactor(t);
    if (f !== null) factors.set(t.id, f);
  }
  const sums = new Map<string, number>(); // `${trackerId}|${periodStart}`
  for (const e of entries) {
    const f = factors.get(e.trackerId);
    if (f === undefined || e.date < from || e.date > to) continue;
    const key = `${e.trackerId}|${periodBounds(e.date, bucket).start}`;
    sums.set(key, (sums.get(key) ?? 0) + e.value * f);
  }
  const starts = bucketStarts(from, to, bucket);
  return [...factors.keys()].flatMap((trackerId) =>
    starts.map((periodStart) => ({ trackerId, periodStart, minutes: sums.get(`${trackerId}|${periodStart}`) ?? 0 })),
  );
}
