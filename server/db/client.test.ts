import { describe, expect, it } from 'vitest';
import { createDb } from './client';
import { areas, entries, trackers } from './schema';
import { seedIfEmpty } from './seed';

describe('createDb + seedIfEmpty', () => {
  it('seeds the five areas and six trackers exactly once', () => {
    const db = createDb(':memory:');
    seedIfEmpty(db);
    expect(db.select().from(areas).all().map((a) => a.name).sort())
      .toEqual(['Fitness', 'Habits', 'Learning', 'Mood', 'Reading']);
    expect(db.select().from(trackers).all().map((t) => [t.name, t.kind, t.unit]).sort()).toEqual([
      ['CS study', 'quantity', 'minutes'], ['Chinese study', 'quantity', 'minutes'],
      ['Lifting', 'quantity', 'minutes'], ['Mood', 'rating', null],
      ['Pickleball', 'quantity', 'minutes'], ['Tennis', 'quantity', 'minutes'],
    ]);
    seedIfEmpty(db); // idempotent
    expect(db.select().from(areas).all()).toHaveLength(5);
  });

  it('enforces one entry per tracker per day', () => {
    const db = createDb(':memory:');
    seedIfEmpty(db);
    const t = db.select().from(trackers).all()[0];
    db.insert(entries).values({ trackerId: t.id, date: '2026-10-31', value: 30 }).run();
    expect(() => db.insert(entries).values({ trackerId: t.id, date: '2026-10-31', value: 40 }).run()).toThrow();
  });

  it('enforces foreign keys', () => {
    const db = createDb(':memory:');
    expect(() => db.insert(trackers).values({ areaId: 999, name: 'x', kind: 'check' }).run()).toThrow();
  });
});
