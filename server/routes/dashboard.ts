import { Hono } from 'hono';
import { addDays, periodBounds } from '../../shared/dates';
import type { DashboardData, DateStr } from '../../shared/types';
import type { Db } from '../db/client';
import { areas, entries, readingLog, trackers } from '../db/schema';
import { pagesReadByDate, readingDates } from '../stats/reading';
import { isBooksArea } from './books-area';
import { activeDates } from '../stats/streaks';
import { goalsWithProgress } from './goals';

const WEEKS = 12;

export function dashboardRoutes(db: Db, today: () => DateStr) {
  return new Hono().get('/dashboard', (c) => {
    const now = today();
    const allTrackers = db.select().from(trackers).all();
    const allEntries = db.select().from(entries).all();
    const yearAgo = addDays(now, -364);
    const moodFrom = addDays(now, -89);
    const thisWeek = periodBounds(now, 'week').start;
    const weekStarts = Array.from({ length: WEEKS }, (_, i) => addDays(thisWeek, -7 * (WEEKS - 1 - i)));
    // Every date maps to the Monday of its week; only the 12 tracked weeks are kept.
    const weekOf = (d: DateStr) => periodBounds(d, 'week').start;

    const logs = db.select().from(readingLog).all();
    const areaRows = db.select().from(areas).all().map((area) => {
      const ids = new Set(allTrackers.filter((t) => t.areaId === area.id).map((t) => t.id));
      const active = activeDates(allEntries, ids);
      if (isBooksArea(area)) for (const d of readingDates(logs)) active.add(d);
      const dates = [...active].filter((d) => d >= yearAgo && d <= now).sort();
      return { area, activeDates: dates };
    });

    const totals = new Map<string, number>(); // `${trackerId}|${weekStart}`
    for (const e of allEntries) {
      if (e.date < weekStarts[0] || e.date > now) continue;
      const key = `${e.trackerId}|${weekOf(e.date)}`;
      totals.set(key, (totals.get(key) ?? 0) + e.value);
    }
    const weeklyTotals = allTrackers
      .filter((t) => t.kind === 'quantity')
      .flatMap((t) => weekStarts.map((weekStart) => ({ trackerId: t.id, weekStart, total: totals.get(`${t.id}|${weekStart}`) ?? 0 })));

    const ratingIds = new Set(allTrackers.filter((t) => t.kind === 'rating').map((t) => t.id));
    const mood = allEntries
      .filter((e) => ratingIds.has(e.trackerId) && e.date >= moodFrom && e.date <= now)
      .map((e) => ({ trackerId: e.trackerId, date: e.date, value: e.value }))
      .sort((a, b) => a.date.localeCompare(b.date));

    // Deltas need each book's full history, so diff everything, then bucket.
    const pages = new Map<DateStr, number>();
    for (const [date, n] of pagesReadByDate(logs)) {
      if (date < weekStarts[0] || date > now) continue;
      pages.set(weekOf(date), (pages.get(weekOf(date)) ?? 0) + n);
    }
    const pagesPerWeek = weekStarts.map((weekStart) => ({ weekStart, pages: pages.get(weekStart) ?? 0 }));

    const out: DashboardData = { today: now, areas: areaRows, goals: goalsWithProgress(db, now), weeklyTotals, mood, pagesPerWeek };
    return c.json(out);
  });
}
