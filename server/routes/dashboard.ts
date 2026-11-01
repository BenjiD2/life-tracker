import { Hono } from 'hono';
import { addDays, periodBounds } from '../../shared/dates';
import { rangeQuery } from '../../shared/schemas';
import type { DashboardData, DateStr } from '../../shared/types';
import type { Db } from '../db/client';
import { areas, books, entries, readingLog, trackers } from '../db/schema';
import { bucketFor, bucketStarts } from '../stats/buckets';
import { pagesReadByDate, readingDates } from '../stats/reading';
import { activeDates } from '../stats/streaks';
import { minutesPerBucket } from '../stats/time';
import { isBooksArea } from './books-area';
import { goalsWithProgress } from './goals';
import { validate } from './http';

const DEFAULT_WEEKS = 12;

export function dashboardRoutes(db: Db, today: () => DateStr) {
  return new Hono().get('/dashboard', validate('query', rangeQuery), (c) => {
    const now = today();
    const q = c.req.valid('query');
    // Default: the last 12 weeks, including the current one.
    const to = q.to ?? now;
    const from = q.from ?? addDays(periodBounds(now, 'week').start, -7 * (DEFAULT_WEEKS - 1));
    const inRange = (d: DateStr) => d >= from && d <= to;
    const bucket = bucketFor(from, to);
    const starts = bucketStarts(from, to, bucket);
    const bucketOf = (d: DateStr) => periodBounds(d, bucket).start;

    const allTrackers = db.select().from(trackers).all();
    const allEntries = db.select().from(entries).all();
    const logs = db.select().from(readingLog).all();
    const startPages = new Map(db.select().from(books).all().map((b) => [b.id, b.startPage]));
    // Deltas need each book's full history, so diff everything, then keep the range.
    const pagesByDate = pagesReadByDate(logs, startPages);

    const areaRows = db.select().from(areas).all().map((area) => {
      const ids = new Set(allTrackers.filter((t) => t.areaId === area.id).map((t) => t.id));
      const active = activeDates(allEntries, ids);
      if (isBooksArea(area)) for (const d of readingDates(logs, startPages)) active.add(d);
      return { area, activeDates: [...active].filter(inRange).sort() };
    });

    const totals = new Map<string, number>(); // `${trackerId}|${periodStart}`
    for (const e of allEntries) {
      if (!inRange(e.date)) continue;
      const key = `${e.trackerId}|${bucketOf(e.date)}`;
      totals.set(key, (totals.get(key) ?? 0) + e.value);
    }
    const trackerTotals = allTrackers
      .filter((t) => t.kind === 'quantity')
      .flatMap((t) => starts.map((periodStart) => ({ trackerId: t.id, periodStart, total: totals.get(`${t.id}|${periodStart}`) ?? 0 })));

    const ratingIds = new Set(allTrackers.filter((t) => t.kind === 'rating').map((t) => t.id));
    const mood = allEntries
      .filter((e) => ratingIds.has(e.trackerId) && inRange(e.date))
      .map((e) => ({ trackerId: e.trackerId, date: e.date, value: e.value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    const pages = new Map<DateStr, number>();
    for (const [date, n] of pagesByDate) if (inRange(date)) pages.set(bucketOf(date), (pages.get(bucketOf(date)) ?? 0) + n);
    const pagesRead = starts.map((periodStart) => ({ periodStart, pages: pages.get(periodStart) ?? 0 }));

    const out: DashboardData = {
      today: now, from, to, bucket, areas: areaRows, goals: goalsWithProgress(db, now), trackerTotals,
      trackerMinutes: minutesPerBucket(allTrackers, allEntries, from, to, bucket), mood, pagesRead,
    };
    return c.json(out);
  });
}
