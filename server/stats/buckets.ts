import { addDays, daysBetween, periodBounds } from '../../shared/dates';
import type { DateStr, Period } from '../../shared/types';

/** Weekly bars up to ~26 weeks; beyond that, monthly, so a year isn't 52 slivers. */
export function bucketFor(from: DateStr, to: DateStr): Period {
  return daysBetween(from, to) <= 182 ? 'week' : 'month';
}

/** Start dates of every week (Monday) or month that overlaps [from, to], ascending. */
export function bucketStarts(from: DateStr, to: DateStr, bucket: Period): DateStr[] {
  const out: DateStr[] = [];
  for (let b = periodBounds(from, bucket); b.start <= to; b = periodBounds(addDays(b.end, 1), bucket)) out.push(b.start);
  return out;
}
