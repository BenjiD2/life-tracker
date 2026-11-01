import { formatDate } from '../../shared/dates';
import type { DateStr } from '../../shared/types';

export const formatNumber = (n: number) => n.toLocaleString(undefined, { maximumFractionDigits: 1 });

/** 'Sat, Oct 31' */
export const formatDay = (d: DateStr) => formatDate(d, { weekday: 'short', month: 'short', day: 'numeric' });

/** "Oct '26" for monthly axis ticks. */
export const formatMonth = (d: DateStr) => `${formatDate(d, { month: 'short' })} '${d.slice(2, 4)}`;

/** 'Oct 12' for axis ticks. */
export const formatShort = (d: DateStr) => formatDate(d, { month: 'short', day: 'numeric' });
