import { periodBounds } from '../../shared/dates';
import type { DateStr, Kind, Period } from '../../shared/types';
import { bucketStarts } from './buckets';

type EntryValue = { trackerId: number; date: DateStr; value: number };
type TrackerKind = { id: number; kind: Kind };

const idsOfKind = (trackers: TrackerKind[], kind: Kind) => new Set(trackers.filter((t) => t.kind === kind).map((t) => t.id));

/** Total per quantity tracker per bucket overlapping [from, to], zero-filled; only days inside the range count. Rows follow tracker order, then bucket. */
export function totalsPerBucket(
  trackers: TrackerKind[],
  entries: EntryValue[],
  from: DateStr,
  to: DateStr,
  bucket: Period,
): { trackerId: number; periodStart: DateStr; total: number }[] {
  const sums = new Map<string, number>(); // `${trackerId}|${periodStart}`
  for (const e of entries) {
    if (e.date < from || e.date > to) continue;
    const key = `${e.trackerId}|${periodBounds(e.date, bucket).start}`;
    sums.set(key, (sums.get(key) ?? 0) + e.value);
  }
  const starts = bucketStarts(from, to, bucket);
  return [...idsOfKind(trackers, 'quantity')].flatMap((trackerId) =>
    starts.map((periodStart) => ({ trackerId, periodStart, total: sums.get(`${trackerId}|${periodStart}`) ?? 0 })),
  );
}

/** Rating entries inside [from, to], ascending by date. */
export function ratingSeries(trackers: TrackerKind[], entries: EntryValue[], from: DateStr, to: DateStr): EntryValue[] {
  const ids = idsOfKind(trackers, 'rating');
  return entries
    .filter((e) => ids.has(e.trackerId) && e.date >= from && e.date <= to)
    .map(({ trackerId, date, value }) => ({ trackerId, date, value }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

/** Days logged per check tracker inside [from, to]; trackers with none are left out. */
export function checkDaysInRange(
  trackers: TrackerKind[],
  entries: EntryValue[],
  from: DateStr,
  to: DateStr,
): { trackerId: number; days: number }[] {
  const days = new Map<number, number>();
  const ids = idsOfKind(trackers, 'check');
  for (const e of entries) if (ids.has(e.trackerId) && e.date >= from && e.date <= to) days.set(e.trackerId, (days.get(e.trackerId) ?? 0) + 1);
  return [...ids].flatMap((trackerId) => (days.has(trackerId) ? [{ trackerId, days: days.get(trackerId)! }] : []));
}
