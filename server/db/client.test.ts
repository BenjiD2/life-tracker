import Database from 'better-sqlite3';
import { drizzle } from 'drizzle-orm/better-sqlite3';
import { migrate } from 'drizzle-orm/better-sqlite3/migrator';
import { cpSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
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

  it('seeds trackers with distinct positions in seed order', () => {
    const db = createDb(':memory:');
    seedIfEmpty(db);
    const names = db.select().from(trackers).all().sort((a, b) => a.position - b.position).map((t) => t.name);
    expect(names).toEqual(['Tennis', 'Pickleball', 'Lifting', 'Mood', 'Chinese study', 'CS study']);
    expect(new Set(db.select().from(trackers).all().map((t) => t.position)).size).toBe(6);
  });
});

describe('position migration', () => {
  it('gives existing trackers position = id, so nothing moves on first load', () => {
    const dir = mkdtempSync(join(tmpdir(), 'tracker-migration-'));
    try {
      // The migrations as they were before the position column: the first three.
      const old = join(dir, 'migrations');
      cpSync(fileURLToPath(new URL('./migrations', import.meta.url)), old, { recursive: true });
      const journalPath = join(old, 'meta', '_journal.json');
      const journal = JSON.parse(readFileSync(journalPath, 'utf8'));
      journal.entries = journal.entries.slice(0, 3);
      writeFileSync(journalPath, JSON.stringify(journal));

      const file = join(dir, 'old.db');
      const sqlite = new Database(file);
      migrate(drizzle(sqlite), { migrationsFolder: old });
      sqlite.exec(`INSERT INTO areas (id, name, color) VALUES (1, 'A', '#000000');
        INSERT INTO trackers (id, area_id, name, kind) VALUES (3, 1, 'x', 'check'), (7, 1, 'y', 'check'), (12, 1, 'z', 'check');`);
      sqlite.close();

      const rows = createDb(file).select().from(trackers).all();
      expect(rows.map((t) => [t.id, t.position])).toEqual([[3, 3], [7, 7], [12, 12]]);
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});
