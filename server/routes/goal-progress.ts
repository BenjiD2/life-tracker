import { eq } from 'drizzle-orm';
import { isBooksArea } from '../../shared/books-area';
import type { DateStr, GoalWithProgress } from '../../shared/types';
import type { Db } from '../db/client';
import { areas, books, entries, goalItems, goals, readingLog, trackers } from '../db/schema';
import { goalProgress } from '../stats/goals';
import { readingDates } from '../stats/reading';
import { activeDates } from '../stats/streaks';

/**
 * Every goal (or just `onlyId`) with its items and calculated progress.
 * Loads each table once and filters per goal; all math lives in stats/.
 */
export function goalsWithProgress(db: Db, today: DateStr, onlyId?: number): GoalWithProgress[] {
  const goalRows = onlyId === undefined ? db.select().from(goals).all() : db.select().from(goals).where(eq(goals.id, onlyId)).all();
  if (goalRows.length === 0) return [];
  const allTrackers = db.select().from(trackers).all(); // archived included: their history still counts
  const allEntries = db.select().from(entries).all();
  const allBooks = db.select().from(books).all();
  const allItems = db.select().from(goalItems).all();
  const booksAreaIds = new Set(db.select().from(areas).all().filter(isBooksArea).map((a) => a.id));
  const readDays =
    booksAreaIds.size > 0
      ? readingDates(db.select().from(readingLog).all(), new Map(allBooks.map((b) => [b.id, b.startPage])))
      : new Set<DateStr>();

  return goalRows.map((goal) => {
    const items = allItems.filter((i) => i.goalId === goal.id);
    const scope = new Set(
      goal.scopeTrackerId !== null
        ? [goal.scopeTrackerId]
        : allTrackers.filter((t) => t.areaId === goal.areaId).map((t) => t.id),
    );
    // An area-wide goal on the books area also counts reading days.
    const countsReading = goal.scopeTrackerId === null && booksAreaIds.has(goal.areaId);
    const goalDates = goal.type === 'consistency' ? activeDates(allEntries, scope, countsReading ? readDays : []) : new Set<DateStr>();
    const progress = goalProgress(
      goal,
      {
        activeDates: goalDates,
        books: allBooks,
        entries: goal.sourceTrackerId === null ? [] : allEntries.filter((e) => e.trackerId === goal.sourceTrackerId),
        items,
      },
      today,
    );
    return { ...goal, items, progress };
  });
}
