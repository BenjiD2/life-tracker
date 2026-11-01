import { periodBounds } from '../../shared/dates';
import type { DateStr, Period } from '../../shared/types';
import { bucketStarts } from './buckets';

/**
 * Pages read on each date: for every book, its page position minus the previous
 * position, summed across books. Logs may arrive in any order. Before a book's first log
 * the position is its starting page from `startPages` (progress from before tracking), else 0.
 * A downward correction counts as 0 pages, never negative.
 */
export function pagesReadByDate(
  logs: { bookId: number; date: DateStr; pageReached: number }[],
  startPages: ReadonlyMap<number, number> = new Map(),
): Map<DateStr, number> {
  const out = new Map<DateStr, number>();
  const sorted = [...logs].sort((a, b) => a.bookId - b.bookId || a.date.localeCompare(b.date));
  let prevBook: number | null = null;
  let prevPage = 0;
  for (const log of sorted) {
    if (log.bookId !== prevBook) {
      prevBook = log.bookId;
      prevPage = startPages.get(log.bookId) ?? 0;
    }
    out.set(log.date, (out.get(log.date) ?? 0) + Math.max(0, log.pageReached - prevPage));
    prevPage = log.pageReached;
  }
  return out;
}

/** Dates on which any pages were read (a downward correction alone is not reading). */
export function readingDates(
  logs: { bookId: number; date: DateStr; pageReached: number }[],
  startPages: ReadonlyMap<number, number> = new Map(),
): Set<DateStr> {
  const out = new Set<DateStr>();
  for (const [date, pages] of pagesReadByDate(logs, startPages)) if (pages > 0) out.add(date);
  return out;
}

/** Pages read per bucket overlapping [from, to], zero-filled; only days inside the range count. */
export function pagesPerBucket(
  pagesByDate: ReadonlyMap<DateStr, number>,
  from: DateStr,
  to: DateStr,
  bucket: Period,
): { periodStart: DateStr; pages: number }[] {
  const sums = new Map<DateStr, number>();
  for (const [date, pages] of pagesByDate) {
    if (date < from || date > to) continue;
    const start = periodBounds(date, bucket).start;
    sums.set(start, (sums.get(start) ?? 0) + pages);
  }
  return bucketStarts(from, to, bucket).map((periodStart) => ({ periodStart, pages: sums.get(periodStart) ?? 0 }));
}

/** Each logged book's page position on its latest logged date. */
export function latestPages(logs: { bookId: number; date: DateStr; pageReached: number }[]): Map<number, number> {
  const latest = new Map<number, { date: DateStr; page: number }>();
  for (const log of logs) {
    const held = latest.get(log.bookId);
    if (!held || log.date > held.date) latest.set(log.bookId, { date: log.date, page: log.pageReached });
  }
  return new Map([...latest].map(([bookId, { page }]) => [bookId, page]));
}
