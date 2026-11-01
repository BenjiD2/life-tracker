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

export type AreaInput = z.infer<typeof areaInput>;
export type AreaPatch = z.infer<typeof areaPatch>;
export type TrackerInput = z.infer<typeof trackerInput>;
export type TrackerPatch = z.infer<typeof trackerPatch>;
export type EntryInput = z.infer<typeof entryInput>;
