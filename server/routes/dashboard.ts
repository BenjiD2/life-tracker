import { Hono } from 'hono';
import { isBooksArea } from '../../shared/books-area';
import { rangeQuery } from '../../shared/schemas';
import type { DashboardData, DateStr } from '../../shared/types';
import type { Db } from '../db/client';
import { areas, books, entries, readingLog, trackers } from '../db/schema';
import { bucketFor } from '../stats/buckets';
import { checkDaysInRange, ratingSeries, totalsPerBucket } from '../stats/dashboard';
import { pagesPerBucket, pagesReadByDate, readingDates } from '../stats/reading';
import { activeDates, datesInRange } from '../stats/streaks';
import { minutesPerBucket } from '../stats/time';
import { goalsWithProgress } from './goal-progress';
import { validate } from './http';

export function dashboardRoutes(db: Db, today: () => DateStr) {
  return new Hono().get('/dashboard', validate('query', rangeQuery), (c) => {
    const now = today();
    const { from, to } = c.req.valid('query');
    const bucket = bucketFor(from, to);

    const allTrackers = db.select().from(trackers).all();
    const allEntries = db.select().from(entries).all();
    // Deltas need each book's full history, so diff everything, then keep the range.
    const logs = db.select().from(readingLog).all();
    const startPages = new Map(db.select().from(books).all().map((b) => [b.id, b.startPage]));
    const readDays = readingDates(logs, startPages);

    const areaRows = db.select().from(areas).all().map((area) => {
      const ids = new Set(allTrackers.filter((t) => t.areaId === area.id).map((t) => t.id));
      const active = activeDates(allEntries, ids, isBooksArea(area) ? readDays : []);
      return { area, activeDates: datesInRange(active, from, to) };
    });

    const trackerTotals = totalsPerBucket(allTrackers, allEntries, from, to, bucket);
    const out: DashboardData = {
      today: now, from, to, bucket, trackers: allTrackers, areas: areaRows, goals: goalsWithProgress(db, now), trackerTotals,
      trackerMinutes: minutesPerBucket(allTrackers, trackerTotals),
      checkDays: checkDaysInRange(allTrackers, allEntries, from, to),
      mood: ratingSeries(allTrackers, allEntries, from, to),
      pagesRead: pagesPerBucket(pagesReadByDate(logs, startPages), from, to, bucket),
    };
    return c.json(out);
  });
}
