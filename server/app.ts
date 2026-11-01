import { Hono } from 'hono';
import type { DateStr } from '../shared/types';
import type { Db } from './db/client';
import { bookRoutes } from './routes/books';
import { catalogRoutes } from './routes/catalog';
import { goalRoutes } from './routes/goals';
import { dashboardRoutes } from './routes/dashboard';
import { entryRoutes } from './routes/entries';

/** The whole API. `today` is injected so tests can pin the date. */
export function createApp(db: Db, today: () => DateStr) {
  const app = new Hono()
    .route('/api', catalogRoutes(db))
    .route('/api', entryRoutes(db))
    .route('/api', bookRoutes(db, today))
    .route('/api', goalRoutes(db, today))
    .route('/api', dashboardRoutes(db, today));
  app.notFound((c) => c.json({ error: 'Not found' }, 404));
  app.onError((err, c) => {
    console.error(err);
    return c.json({ error: err.message || 'Internal server error' }, 500);
  });
  return app;
}
