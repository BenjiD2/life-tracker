import type { DateStr } from '../../shared/types';

export const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** 'Sat, Oct 31' for a DateStr, without passing through local-time Date parsing. */
export function formatDay(d: DateStr): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, {
    weekday: 'short', month: 'short', day: 'numeric', timeZone: 'UTC',
  });
}

/** "Oct '26" for monthly axis ticks. */
export function formatMonth(d: DateStr): string {
  const [y, m] = d.split('-').map(Number);
  return `${new Date(Date.UTC(y, m - 1, 1)).toLocaleDateString(undefined, { month: 'short', timeZone: 'UTC' })} '${String(y).slice(2)}`;
}

/** 'Oct 12' for axis ticks. */
export function formatShort(d: DateStr): string {
  const [y, m, day] = d.split('-').map(Number);
  return new Date(Date.UTC(y, m - 1, day)).toLocaleDateString(undefined, { month: 'short', day: 'numeric', timeZone: 'UTC' });
}
