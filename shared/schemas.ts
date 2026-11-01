import { z } from 'zod';
import { isDateStr } from './dates';
import { BOOK_STATUSES, KINDS, PERIODS } from './enums';

export const dateStr = z.string().refine(isDateStr, 'must be a real date in YYYY-MM-DD form');
const id = z.number().int().positive();
const name = z.string().trim().min(1, 'is required');

export const areaInput = z.object({
  name,
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'must be a hex color like #1a2b3c'),
});
export const areaPatch = areaInput.partial().strict();

// Empty or whitespace means no subject, so clearing the field in the UI stores null.
const subject = z.string().trim().transform((s) => s || null).nullable();
const minutesPerUnit = z.number().finite().positive('must be more than 0').nullable();
export const trackerInput = z.object({
  areaId: id,
  name,
  kind: z.enum(KINDS),
  unit: z.string().trim().min(1).nullish(),
  subject: subject.optional(),
  minutesPerUnit: minutesPerUnit.optional(),
}).strict(); // so `position` (set by the server) is refused rather than ignored
// .strict(): `kind` is immutable after creation, so sending it is an error rather than silently ignored.
export const trackerPatch = z
  .object({ name, unit: z.string().trim().min(1).nullable(), archived: z.boolean(), areaId: id, subject, minutesPerUnit })
  .partial()
  .strict();
/** Every tracker id, archived included, in the new order. */
export const trackerOrder = z.object({ ids: z.array(id) });

export const entryInput = z.object({
  trackerId: id,
  date: dateStr,
  value: z.number().finite(),
  note: z.string().nullish(),
});
export const entryKey = z.object({ trackerId: z.coerce.number().int().positive(), date: dateStr });
export const dateQuery = z.object({ date: dateStr });
export const rangeQuery = z
  .object({ from: dateStr, to: dateStr })
  .refine((q) => q.from <= q.to, 'from must be on or before to');

export type AreaInput = z.infer<typeof areaInput>;
export type AreaPatch = z.infer<typeof areaPatch>;
export type TrackerInput = z.infer<typeof trackerInput>;
export type TrackerPatch = z.infer<typeof trackerPatch>;
export type TrackerOrder = z.infer<typeof trackerOrder>;
export type EntryInput = z.infer<typeof entryInput>;

const pages = z.number().int().positive('must be at least 1');
const optionalText = z.string().trim().min(1).nullish();

const startPage = z.number().int().min(0, 'must be 0 or more');
export const bookInput = z.object({ title: name, author: name, totalPages: pages, topic: optionalText, startPage: startPage.optional() });
export const bookPatch = z
  .object({
    title: name, author: name, totalPages: pages, topic: optionalText, startPage,
    status: z.enum(BOOK_STATUSES),
    /** When the book was finished, if not today (e.g. the last page was logged on a past date). */
    finished: dateStr,
  })
  .partial()
  .strict();
export const readingLogInput = z.object({
  bookId: id,
  date: dateStr,
  pageReached: z.number().int().min(0, 'must be 0 or more'),
  /** Also mark the book done, as of `date`. Only valid on the book's last page. */
  finish: z.boolean().optional(),
});

export type BookInput = z.infer<typeof bookInput>;
export type BookPatch = z.infer<typeof bookPatch>;
export type ReadingLogInput = z.infer<typeof readingLogInput>;

const goalBase = { title: name, areaId: id };
const goalTarget = z.number({ error: 'is required' }).min(1, 'must be at least 1');
const completionBase = { ...goalBase, type: z.literal('completion'), deadline: dateStr.nullish() };
const completionGoalInput = z.discriminatedUnion('source', [
  z.object({ ...completionBase, source: z.literal('books'), target: goalTarget, bookTopic: optionalText }),
  z.object({
    ...completionBase,
    source: z.literal('tracker'),
    target: goalTarget,
    sourceTrackerId: z.number({ error: 'is required for a tracker goal' }).int().positive('is required for a tracker goal'),
  }),
  // A checklist's target is its item count.
  z.object({ ...completionBase, source: z.literal('checklist') }),
]);
export const goalInput = z.discriminatedUnion('type', [
  z.object({
    ...goalBase,
    type: z.literal('consistency'),
    period: z.enum(PERIODS),
    targetDays: z.number().int().min(1, 'must be at least 1'),
    scopeTrackerId: id.nullish(),
  }),
  completionGoalInput,
]);
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
