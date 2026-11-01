/** A calendar date in local time, formatted 'YYYY-MM-DD'. */
export type DateStr = string;
export type Period = 'week' | 'month';
export type Kind = 'check' | 'quantity' | 'rating';

// Row types mirror server/db/schema.ts as plain interfaces, so the web never imports server code.

export interface Area {
  id: number;
  name: string;
  color: string;
}

export interface Tracker {
  id: number;
  areaId: number;
  name: string;
  kind: Kind;
  unit: string | null;
  archived: boolean;
  /** Free-text tag grouping trackers within an area; see shared/subjects.ts. */
  subject: string | null;
  /** Quantity trackers only: minutes one unit is worth, for estimated time. */
  minutesPerUnit: number | null;
}

export interface Entry {
  id: number;
  trackerId: number;
  date: DateStr;
  value: number;
  note: string | null;
}

export type BookStatus = 'reading' | 'done' | 'dropped';

export interface Book {
  id: number;
  title: string;
  author: string;
  totalPages: number;
  /** Page already reached before tracking began (0 for a new book). */
  startPage: number;
  status: BookStatus;
  topic: string | null;
  started: DateStr | null;
  finished: DateStr | null;
}

export interface ReadingLogRow {
  id: number;
  bookId: number;
  date: DateStr;
  pageReached: number;
}

export type GoalType = 'consistency' | 'completion';
export type GoalSource = 'books' | 'tracker' | 'checklist';

export interface Goal {
  id: number;
  title: string;
  areaId: number;
  type: GoalType;
  created: DateStr;
  scopeTrackerId: number | null;
  period: Period | null;
  targetDays: number | null;
  source: GoalSource | null;
  target: number | null;
  deadline: DateStr | null;
  sourceTrackerId: number | null;
  bookTopic: string | null;
}

export interface GoalItem {
  id: number;
  goalId: number;
  label: string;
  doneAt: DateStr | null;
}

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
