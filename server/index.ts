import { serve } from '@hono/node-server';
import { todayLocal } from '../shared/dates';
import { createApp } from './app';
import { createDb } from './db/client';
import { seedIfEmpty } from './db/seed';

// TRACKER_DB lets a throwaway database be used for trying things out.
const db = createDb(process.env.TRACKER_DB ?? 'tracker.db');
seedIfEmpty(db);
const app = createApp(db, () => todayLocal());

serve({ fetch: app.fetch, port: Number(process.env.PORT ?? 3000) }, (info) => {
  console.log(`life-tracker API on http://localhost:${info.port}`);
});
