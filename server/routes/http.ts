import { zValidator } from '@hono/zod-validator';
import type { Context, ValidationTargets } from 'hono';
import type { ZodType } from 'zod';

/** zValidator that answers failures with the API's `{ error: string }` shape and status 400. */
export function validate<T extends keyof ValidationTargets, S extends ZodType>(target: T, schema: S) {
  return zValidator(target, schema, (result, c) => {
    if (!result.success) {
      const issue = result.error.issues[0];
      const where = issue.path.length ? `${issue.path.join('.')} ` : '';
      return c.json({ error: `${where}${issue.message}`.trim() }, 400);
    }
  });
}

export const fail = (c: Context, status: 400 | 404 | 409, error: string) => c.json({ error }, status);

/** Route `:id` as a positive integer, or null (callers answer 404). */
export function paramId(c: Context): number | null {
  const n = Number(c.req.param('id'));
  return Number.isInteger(n) && n > 0 ? n : null;
}
