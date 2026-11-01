import { serve } from '@hono/node-server';
import { todayLocal } from '../shared/dates';
import { createApp } from './app';
import { createDb } from './db/client';
import { seedIfEmpty } from './db/seed';

const db = createDb('tracker.db');
seedIfEmpty(db);
const app = createApp(db, () => todayLocal());

serve({ fetch: app.fetch, port: 3000 }, (info) => {
  console.log(`life-tracker API on http://localhost:${info.port}`);
});
