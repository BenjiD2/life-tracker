import { asc, eq, max } from 'drizzle-orm';
import { Hono } from 'hono';
import { areaInput, areaPatch, trackerInput, trackerOrder, trackerPatch } from '../../shared/schemas';
import type { Db } from '../db/client';
import { areas, goals, trackers } from '../db/schema';
import { fail, paramId, validate } from './http';

const NOT_QUANTITY = 'Minutes per unit only applies to quantity trackers';

export function catalogRoutes(db: Db) {
  const findArea = (id: number | null) => (id === null ? undefined : db.select().from(areas).where(eq(areas.id, id)).get());
  const trackersInOrder = () => db.select().from(trackers).orderBy(asc(trackers.position), asc(trackers.id)).all();

  return new Hono()
    .get('/areas', (c) => c.json(db.select().from(areas).all()))
    .post('/areas', validate('json', areaInput), (c) => {
      const row = db.insert(areas).values(c.req.valid('json')).returning().get();
      return c.json(row, 201);
    })
    .patch('/areas/:id', validate('json', areaPatch), (c) => {
      const area = findArea(paramId(c));
      if (!area) return fail(c, 404, 'Area not found');
      const patch = c.req.valid('json');
      if (Object.keys(patch).length === 0) return c.json(area);
      return c.json(db.update(areas).set(patch).where(eq(areas.id, area.id)).returning().get());
    })
    .delete('/areas/:id', (c) => {
      const area = findArea(paramId(c));
      if (!area) return fail(c, 404, 'Area not found');
      const own = db.select().from(trackers).where(eq(trackers.areaId, area.id)).all();
      if (own.length > 0) {
        // Trackers are never deleted (their history counts), so the way out is moving them.
        const names = own.map((t) => (t.archived ? `${t.name} (archived)` : t.name)).join(', ');
        return fail(c, 409, `"${area.name}" still has trackers: ${names}. Move them to another area first.`);
      }
      if (db.select({ id: goals.id }).from(goals).where(eq(goals.areaId, area.id)).limit(1).get())
        return fail(c, 409, `"${area.name}" still has goals; delete them first`);
      db.delete(areas).where(eq(areas.id, area.id)).run();
      return c.body(null, 204);
    })

    .get('/trackers', (c) => c.json(trackersInOrder()))
    .post('/trackers', validate('json', trackerInput), (c) => {
      const input = c.req.valid('json');
      if (!findArea(input.areaId)) return fail(c, 404, 'Area not found');
      if (input.minutesPerUnit != null && input.kind !== 'quantity') return fail(c, 400, NOT_QUANTITY);
      const last = db.select({ position: max(trackers.position) }).from(trackers).get()?.position;
      const row = db
        .insert(trackers)
        .values({
          ...input, unit: input.unit ?? null, subject: input.subject ?? null, minutesPerUnit: input.minutesPerUnit ?? null,
          position: last == null ? 0 : last + 1,
        })
        .returning()
        .get();
      return c.json(row, 201);
    })
    .put('/trackers/order', validate('json', trackerOrder), (c) => {
      const { ids } = c.req.valid('json');
      const existing = new Set(db.select({ id: trackers.id }).from(trackers).all().map((t) => t.id));
      if (ids.length !== existing.size || new Set(ids).size !== ids.length || !ids.every((id) => existing.has(id)))
        return fail(c, 400, 'Order must list every tracker exactly once');
      db.transaction((tx) => {
        ids.forEach((id, position) => tx.update(trackers).set({ position }).where(eq(trackers.id, id)).run());
      });
      return c.json(trackersInOrder());
    })
    .patch('/trackers/:id', validate('json', trackerPatch), (c) => {
      const id = paramId(c);
      const tracker = id === null ? undefined : db.select().from(trackers).where(eq(trackers.id, id)).get();
      if (!tracker) return fail(c, 404, 'Tracker not found');
      const patch = c.req.valid('json');
      if (patch.minutesPerUnit != null && tracker.kind !== 'quantity') return fail(c, 400, NOT_QUANTITY);
      if (patch.areaId !== undefined && patch.areaId !== tracker.areaId) {
        if (!findArea(patch.areaId)) return fail(c, 404, 'Area not found');
        // A goal scoped to this tracker belongs to its current area; moving it would split the two.
        const scoped = db.select().from(goals).where(eq(goals.scopeTrackerId, tracker.id)).all();
        if (scoped.length > 0)
          return fail(c, 409, `Goals scoped to ${tracker.name} would end up in a different area: ${scoped.map((g) => `"${g.title}"`).join(', ')}. Delete those goals first.`);
      }
      if (Object.keys(patch).length === 0) return c.json(tracker);
      return c.json(db.update(trackers).set(patch).where(eq(trackers.id, tracker.id)).returning().get());
    });
}
