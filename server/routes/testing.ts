import { createApp } from '../app';
import { createDb } from '../db/client';
import { seedIfEmpty } from '../db/seed';
import { trackers } from '../db/schema';
import type { DateStr } from '../../shared/types';

/** A seeded in-memory app with a fixed `today`, plus a JSON request helper. */
export function setup(today: DateStr = '2026-10-15') {
  const db = createDb(':memory:');
  seedIfEmpty(db);
  const app = createApp(db, () => today);
  async function req(method: string, path: string, body?: unknown) {
    const res = await app.request(path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
    const text = await res.text();
    return { status: res.status, body: text ? JSON.parse(text) : null };
  }
  const trackerId = (name: string) => db.select().from(trackers).all().find((t) => t.name === name)!.id;
  return { app, db, req, trackerId };
}
