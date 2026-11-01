import { and, eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { dateQuery, entryInput, entryKey } from '../../shared/schemas';
import type { Kind } from '../../shared/types';
import type { Db } from '../db/client';
import { entries, trackers } from '../db/schema';
import { fail, validate } from './http';

/** Why `value` is invalid for a tracker of this kind (spec §7), or null if it's fine. */
function valueError(kind: Kind, value: number): string | null {
  switch (kind) {
    case 'check':
      return value === 1 ? null : 'A check entry must have value 1 (uncheck by deleting it)';
    case 'rating':
      return Number.isInteger(value) && value >= 1 && value <= 5 ? null : 'Rating must be a whole number 1–5';
    case 'quantity':
      return value >= 0 ? null : 'Amount must be 0 or more';
  }
}

export function entryRoutes(db: Db) {
  return new Hono()
    .get('/entries', validate('query', dateQuery), (c) =>
      c.json(db.select().from(entries).where(eq(entries.date, c.req.valid('query').date)).all()),
    )
    .put('/entries', validate('json', entryInput), (c) => {
      const input = c.req.valid('json');
      const tracker = db.select().from(trackers).where(eq(trackers.id, input.trackerId)).get();
      if (!tracker) return fail(c, 404, 'Tracker not found');
      const error = valueError(tracker.kind, input.value);
      if (error) return fail(c, 400, error);
      const values = { trackerId: input.trackerId, date: input.date, value: input.value, note: input.note ?? null };
      const row = db
        .insert(entries)
        .values(values)
        .onConflictDoUpdate({ target: [entries.trackerId, entries.date], set: { value: values.value, note: values.note } })
        .returning()
        .get();
      return c.json(row);
    })
    .delete('/entries', validate('query', entryKey), (c) => {
      const { trackerId, date } = c.req.valid('query');
      db.delete(entries).where(and(eq(entries.trackerId, trackerId), eq(entries.date, date))).run();
      return c.body(null, 204);
    });
}
