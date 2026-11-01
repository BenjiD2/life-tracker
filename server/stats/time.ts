import { minutesFactor, type TimeRule } from '../../shared/subjects';
import type { DateStr } from '../../shared/types';

/**
 * Time in minutes from per-bucket totals: each total times its tracker's `minutesFactor`.
 * Trackers that don't count toward time are left out. Rows keep the order of `totals`.
 */
export function minutesPerBucket(
  trackers: ({ id: number } & TimeRule)[],
  totals: { trackerId: number; periodStart: DateStr; total: number }[],
): { trackerId: number; periodStart: DateStr; minutes: number }[] {
  const factors = new Map(trackers.map((t) => [t.id, minutesFactor(t)]));
  return totals.flatMap(({ trackerId, periodStart, total }) => {
    const factor = factors.get(trackerId);
    return factor === null || factor === undefined ? [] : [{ trackerId, periodStart, minutes: total * factor }];
  });
}
