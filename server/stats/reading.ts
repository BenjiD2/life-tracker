import type { DateStr } from '../../shared/types';

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
