import { z } from 'zod';
import { isDateStr } from './dates';

export const dateStr = z.string().refine(isDateStr, 'must be a real date in YYYY-MM-DD form');
const id = z.number().int().positive();
const name = z.string().trim().min(1, 'is required');

export const areaInput = z.object({
  name,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like #1a2b3c'),
});
export const areaPatch = areaInput.partial().strict();

export const trackerInput = z.object({
  areaId: id,
  name,
  kind: z.enum(['check', 'quantity', 'rating']),
  unit: z.string().trim().min(1).nullish(),
});
// .strict(): `kind` is immutable after creation, so sending it is an error rather than silently ignored.
export const trackerPatch = z
  .object({ name, unit: z.string().trim().min(1).nullable(), archived: z.boolean(), areaId: id })
  .partial()
  .strict();

export const entryInput = z.object({
  trackerId: id,
  date: dateStr,
  value: z.number().finite(),
  note: z.string().nullish(),
});
export const entryKey = z.object({ trackerId: z.coerce.number().int().positive(), date: dateStr });
export const dateQuery = z.object({ date: dateStr });
export const rangeQuery = z
  .object({ from: dateStr.optional(), to: dateStr.optional() })
  .refine((q) => (q.from === undefined) === (q.to === undefined), 'from and to go together')
  .refine((q) => q.from === undefined || q.to === undefined || q.from <= q.to, 'from must be on or before to');

export type AreaInput = z.infer<typeof areaInput>;
export type AreaPatch = z.infer<typeof areaPatch>;
export type TrackerInput = z.infer<typeof trackerInput>;
export type TrackerPatch = z.infer<typeof trackerPatch>;
export type EntryInput = z.infer<typeof entryInput>;

const pages = z.number().int().positive('must be at least 1');
const optionalText = z.string().trim().min(1).nullish();

const startPage = z.number().int().min(0, 'must be 0 or more');
export const bookInput = z.object({ title: name, author: name, totalPages: pages, topic: optionalText, startPage: startPage.optional() });
export const bookPatch = z
  .object({
    title: name, author: name, totalPages: pages, topic: optionalText, startPage,
    status: z.enum(['reading', 'done', 'dropped']),
    /** When the book was finished, if not today (e.g. the last page was logged on a past date). */
    finished: dateStr,
  })
  .partial()
  .strict();
export const readingLogInput = z.object({
  bookId: id,
  date: dateStr,
  pageReached: z.number().int().min(0, 'must be 0 or more'),
});

export type BookInput = z.infer<typeof bookInput>;
export type BookPatch = z.infer<typeof bookPatch>;
export type ReadingLogInput = z.infer<typeof readingLogInput>;

const consistencyGoalInput = z.object({
  type: z.literal('consistency'),
  title: name,
  areaId: id,
  period: z.enum(['week', 'month']),
  targetDays: z.number().int().min(1, 'must be at least 1'),
  scopeTrackerId: id.nullish(),
});
const completionGoalInput = z.object({
  type: z.literal('completion'),
  title: name,
  areaId: id,
  source: z.enum(['books', 'tracker', 'checklist']),
  // Ignored for checklist goals, whose target is their item count.
  target: z.number().positive().min(1, 'must be at least 1').nullish(),
  deadline: dateStr.nullish(),
  sourceTrackerId: id.nullish(),
  bookTopic: optionalText,
});
export const goalInput = z
  .discriminatedUnion('type', [consistencyGoalInput, completionGoalInput])
  .superRefine((g, ctx) => {
    if (g.type !== 'completion') return;
    if (g.source !== 'checklist' && g.target == null)
      ctx.addIssue({ code: 'custom', path: ['target'], message: 'is required' });
    if (g.source === 'tracker' && g.sourceTrackerId == null)
      ctx.addIssue({ code: 'custom', path: ['sourceTrackerId'], message: 'is required for a tracker goal' });
  });
export const goalPatch = z
  .object({
    title: name,
    target: z.number().min(1, 'must be at least 1'),
    targetDays: z.number().int().min(1, 'must be at least 1'),
    deadline: dateStr.nullable(),
  })
  .partial()
  .strict();
export const goalItemInput = z.object({ label: name });
export const goalItemPatch = z.object({ label: name, done: z.boolean() }).partial().strict();

export type GoalInput = z.infer<typeof goalInput>;
export type GoalPatch = z.infer<typeof goalPatch>;
export type GoalItemInput = z.infer<typeof goalItemInput>;
export type GoalItemPatch = z.infer<typeof goalItemPatch>;
