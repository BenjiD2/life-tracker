import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { goalInput, goalItemInput, goalItemPatch, goalPatch } from '../../shared/schemas';
import type { DateStr, Goal, GoalWithProgress } from '../../shared/types';
import type { Db } from '../db/client';
import { areas, books, entries, goalItems, goals, readingLog, trackers } from '../db/schema';
import { readingDates } from '../stats/reading';
import { isBooksArea } from './books-area';
import { goalProgress } from '../stats/goals';
import { activeDates } from '../stats/streaks';
import { fail, paramId, validate } from './http';

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
    let goalDates = new Set<DateStr>();
    if (goal.type === 'consistency') {
      goalDates = activeDates(allEntries, scope);
      // An area-wide goal on the books area also counts reading days.
      if (goal.scopeTrackerId === null && booksAreaIds.has(goal.areaId)) for (const d of readDays) goalDates.add(d);
    }
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

export function goalRoutes(db: Db, today: () => DateStr) {
  const findGoal = (id: number | null) => (id === null ? undefined : db.select().from(goals).where(eq(goals.id, id)).get());
  const findTracker = (id: number) => db.select().from(trackers).where(eq(trackers.id, id)).get();
  const one = (id: number) => goalsWithProgress(db, today(), id)[0];

  return new Hono()
    .get('/goals', (c) => c.json(goalsWithProgress(db, today())))
    .post('/goals', validate('json', goalInput), (c) => {
      const input = c.req.valid('json');
      const created = today();
      if (!db.select().from(areas).where(eq(areas.id, input.areaId)).get()) return fail(c, 404, 'Area not found');

      let row: Omit<Goal, 'id'>;
      if (input.type === 'consistency') {
        if (input.scopeTrackerId != null) {
          const t = findTracker(input.scopeTrackerId);
          if (!t || t.areaId !== input.areaId) return fail(c, 400, 'scopeTrackerId must be a tracker in this area');
        }
        row = {
          title: input.title, areaId: input.areaId, type: 'consistency', created,
          period: input.period, targetDays: input.targetDays, scopeTrackerId: input.scopeTrackerId ?? null,
          source: null, target: null, deadline: null, sourceTrackerId: null, bookTopic: null,
        };
      } else {
        if (input.deadline != null && input.deadline <= created) return fail(c, 400, 'deadline must be after today');
        if (input.source === 'tracker') {
          const t = findTracker(input.sourceTrackerId!);
          if (!t || t.kind !== 'quantity') return fail(c, 400, 'sourceTrackerId must be a quantity tracker');
        }
        row = {
          title: input.title, areaId: input.areaId, type: 'completion', created,
          period: null, targetDays: null, scopeTrackerId: null,
          source: input.source,
          target: input.source === 'checklist' ? null : input.target!,
          deadline: input.deadline ?? null,
          sourceTrackerId: input.source === 'tracker' ? input.sourceTrackerId! : null,
          bookTopic: input.source === 'books' ? (input.bookTopic ?? null) : null,
        };
      }
      const { id } = db.insert(goals).values(row).returning({ id: goals.id }).get();
      return c.json(one(id), 201);
    })
    .patch('/goals/:id', validate('json', goalPatch), (c) => {
      const goal = findGoal(paramId(c));
      if (!goal) return fail(c, 404, 'Goal not found');
      const patch = c.req.valid('json');
      if (patch.deadline != null && patch.deadline <= goal.created)
        return fail(c, 400, 'deadline must be after the goal was created');
      if (Object.keys(patch).length > 0) db.update(goals).set(patch).where(eq(goals.id, goal.id)).run();
      return c.json(one(goal.id));
    })
    .delete('/goals/:id', (c) => {
      const goal = findGoal(paramId(c));
      if (!goal) return fail(c, 404, 'Goal not found');
      db.transaction((tx) => {
        tx.delete(goalItems).where(eq(goalItems.goalId, goal.id)).run();
        tx.delete(goals).where(eq(goals.id, goal.id)).run();
      });
      return c.body(null, 204);
    })

    .post('/goals/:id/items', validate('json', goalItemInput), (c) => {
      const goal = findGoal(paramId(c));
      if (!goal) return fail(c, 404, 'Goal not found');
      if (goal.source !== 'checklist') return fail(c, 400, 'Only checklist goals have items');
      const row = db.insert(goalItems).values({ goalId: goal.id, label: c.req.valid('json').label }).returning().get();
      return c.json(row, 201);
    })
    .patch('/goal-items/:id', validate('json', goalItemPatch), (c) => {
      const id = paramId(c);
      const item = id === null ? undefined : db.select().from(goalItems).where(eq(goalItems.id, id)).get();
      if (!item) return fail(c, 404, 'Item not found');
      const { label, done } = c.req.valid('json');
      const set = {
        ...(label !== undefined && { label }),
        // Re-ticking an already-done item keeps its original date.
        ...(done !== undefined && { doneAt: done ? (item.doneAt ?? today()) : null }),
      };
      if (Object.keys(set).length === 0) return c.json(item);
      return c.json(db.update(goalItems).set(set).where(eq(goalItems.id, item.id)).returning().get());
    })
    .delete('/goal-items/:id', (c) => {
      const id = paramId(c);
      if (id === null || !db.select().from(goalItems).where(eq(goalItems.id, id)).get()) return fail(c, 404, 'Item not found');
      db.delete(goalItems).where(eq(goalItems.id, id)).run();
      return c.body(null, 204);
    });
}
