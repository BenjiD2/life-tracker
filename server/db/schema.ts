import { integer, real, sqliteTable, text, uniqueIndex } from 'drizzle-orm/sqlite-core';
import { BOOK_STATUSES, GOAL_SOURCES, GOAL_TYPES, KINDS, PERIODS } from '../../shared/enums';

export const areas = sqliteTable('areas', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  name: text('name').notNull(),
  color: text('color').notNull(),
});

export const trackers = sqliteTable('trackers', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  areaId: integer('area_id').notNull().references(() => areas.id),
  name: text('name').notNull(),
  kind: text('kind', { enum: KINDS }).notNull(),
  unit: text('unit'),
  archived: integer('archived', { mode: 'boolean' }).notNull().default(false),
  /** Free-text tag grouping trackers within an area; see shared/subjects.ts. */
  subject: text('subject'),
  /** Quantity trackers only: minutes one unit is worth, for estimated time. */
  minutesPerUnit: real('minutes_per_unit'),
  /** Saved order: ascending, ties by id. Set by the server on create and by PUT /api/trackers/order. */
  position: integer('position').notNull().default(0),
});

export const entries = sqliteTable(
  'entries',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    trackerId: integer('tracker_id').notNull().references(() => trackers.id),
    date: text('date').notNull(),
    value: real('value').notNull(),
    note: text('note'),
  },
  (t) => [uniqueIndex('entries_tracker_date').on(t.trackerId, t.date)],
);

export const books = sqliteTable('books', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  author: text('author').notNull(),
  totalPages: integer('total_pages').notNull(),
  /** Page already reached before tracking began; the first log's pages read are measured from here. */
  startPage: integer('start_page').notNull().default(0),
  status: text('status', { enum: BOOK_STATUSES }).notNull(),
  topic: text('topic'),
  started: text('started'),
  finished: text('finished'),
});

export const readingLog = sqliteTable(
  'reading_log',
  {
    id: integer('id').primaryKey({ autoIncrement: true }),
    bookId: integer('book_id').notNull().references(() => books.id),
    date: text('date').notNull(),
    pageReached: integer('page_reached').notNull(),
  },
  (t) => [uniqueIndex('reading_log_book_date').on(t.bookId, t.date)],
);

export const goals = sqliteTable('goals', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  title: text('title').notNull(),
  areaId: integer('area_id').notNull().references(() => areas.id),
  type: text('type', { enum: GOAL_TYPES }).notNull(),
  created: text('created').notNull(),
  // consistency fields
  scopeTrackerId: integer('scope_tracker_id').references(() => trackers.id),
  period: text('period', { enum: PERIODS }),
  targetDays: integer('target_days'),
  // completion fields
  source: text('source', { enum: GOAL_SOURCES }),
  target: real('target'),
  deadline: text('deadline'),
  sourceTrackerId: integer('source_tracker_id').references(() => trackers.id),
  bookTopic: text('book_topic'),
});

export const goalItems = sqliteTable('goal_items', {
  id: integer('id').primaryKey({ autoIncrement: true }),
  goalId: integer('goal_id').notNull().references(() => goals.id),
  label: text('label').notNull(),
  doneAt: text('done_at'),
});
