import type { areas, books, entries, goalItems, goals, readingLog, trackers } from '../server/db/schema';
import type { BOOK_STATUSES, GOAL_SOURCES, GOAL_TYPES, KINDS, PERIODS } from './enums';

/** A calendar date in local time, formatted 'YYYY-MM-DD'. */
export type DateStr = string;
export type Period = (typeof PERIODS)[number];
export type Kind = (typeof KINDS)[number];
export type BookStatus = (typeof BOOK_STATUSES)[number];
export type GoalType = (typeof GOAL_TYPES)[number];
export type GoalSource = (typeof GOAL_SOURCES)[number];

// Row types come from the schema. These imports are type-only, so the web still bundles no server code.
export type Area = typeof areas.$inferSelect;
export type Tracker = typeof trackers.$inferSelect;
export type Entry = typeof entries.$inferSelect;
export type Book = typeof books.$inferSelect;
export type ReadingLogRow = typeof readingLog.$inferSelect;
export type Goal = typeof goals.$inferSelect;
export type GoalItem = typeof goalItems.$inferSelect;

/** Calculated, never stored. `percent` is 0–100, and 0 when `target` is 0. */
export interface GoalProgress {
  current: number;
  target: number;
  percent: number;
  /** Consecutive periods met (consistency goals); null for completion goals. */
  streak: number | null;
  /** Where the value should be today on a straight line to the deadline; null without a deadline. */
  expected: number | null;
}

export type BookWithPage = Book & { currentPage: number };
export type GoalWithProgress = Goal & { items: GoalItem[]; progress: GoalProgress };

/** Everything on the dashboard for the range [from, to]. Goals always show their current progress. */
export interface DashboardData {
  today: DateStr;
  from: DateStr;
  to: DateStr;
  /** Bar size for totals: weeks for ranges up to ~26 weeks, months beyond. */
  bucket: Period;
  /** Every tracker, archived included: they still chart while they have data in the range. */
  trackers: Tracker[];
  /** Active dates within the range, ascending. */
  areas: { area: Area; activeDates: DateStr[] }[];
  goals: GoalWithProgress[];
  /** Quantity trackers, one row per bucket overlapping the range, zero-filled. Only days inside the range count. */
  trackerTotals: { trackerId: number; periodStart: DateStr; total: number }[];
  /** Time in minutes for trackers that count toward time (shared/subjects.ts `minutesFactor`), bucketed like `trackerTotals`. */
  trackerMinutes: { trackerId: number; periodStart: DateStr; minutes: number }[];
  /** Days logged per check tracker within the range; trackers with none are left out. */
  checkDays: { trackerId: number; days: number }[];
  /** Rating entries within the range, ascending by date. */
  mood: { trackerId: number; date: DateStr; value: number }[];
  /** Pages read per bucket, zero-filled. */
  pagesRead: { periodStart: DateStr; pages: number }[];
}
