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
