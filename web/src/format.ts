import type { DateStr } from '../../shared/types';

export const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** 'Sat, Oct 31' for a DateStr, without passing through local-time Date parsing. */
export function formatDay(d: DateStr): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}
