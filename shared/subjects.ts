import type { DateStr, Tracker } from './types';

/** The fields that decide whether and how a tracker counts toward time. */
export type TimeRule = Pick<Tracker, 'kind' | 'unit' | 'minutesPerUnit'>;

const MINUTE_UNITS = new Set(['minutes', 'minute', 'min', 'mins']);

export function isMinuteUnit(unit: string | null): boolean {
  return unit !== null && MINUTE_UNITS.has(unit.trim().toLowerCase());
}

/**
 * Minutes one unit of the tracker is worth, or null if it doesn't count toward time.
 * A set `minutesPerUnit` wins over a minute unit, so renaming the unit doesn't silently drop the multiplier.
 */
export function minutesFactor(t: TimeRule): number | null {
  if (t.kind !== 'quantity') return null;
  if (t.minutesPerUnit !== null) return t.minutesPerUnit;
  return isMinuteUnit(t.unit) ? 1 : null;
}

/** Grouping key: trimmed and lower-cased; empty means no subject. */
export function subjectKey(subject: string | null): string | null {
  const key = subject?.trim().toLowerCase();
  return key ? key : null;
}

export interface SubjectGroup<T> {
  key: string | null;
  label: string | null;
  trackers: T[];
}

type Ordered = { id: number; subject: string | null; position: number };

/** Saved order: ascending position, ties broken by id. */
export const byPosition = (a: Ordered, b: Ordered) => a.position - b.position || a.id - b.id;

/**
 * Ungrouped trackers first (if any), then subjects by the lowest position among their trackers in `all`; trackers
 * within a group by position. `all` is the area's full list (archived included), so hiding a tracker neither
 * renames its subject (the label is the spelling of the lowest-id tracker) nor moves it.
 */
export function groupBySubject<T extends Ordered>(trackers: T[], all: readonly Ordered[] = trackers): SubjectGroup<T>[] {
  const subjects = new Map<string, { id: number; label: string; position: number }>();
  for (const t of all) {
    const key = subjectKey(t.subject);
    if (key === null) continue;
    const held = subjects.get(key);
    if (!held) subjects.set(key, { id: t.id, label: t.subject!.trim(), position: t.position });
    else {
      if (t.id < held.id) Object.assign(held, { id: t.id, label: t.subject!.trim() });
      held.position = Math.min(held.position, t.position);
    }
  }
  const groups = new Map<string | null, SubjectGroup<T>>();
  for (const t of [...trackers].sort(byPosition)) {
    const key = subjectKey(t.subject);
    const group = groups.get(key);
    if (group) group.trackers.push(t);
    else groups.set(key, { key, label: key === null ? null : (subjects.get(key)?.label ?? t.subject!.trim()), trackers: [t] });
  }
  // A shown tracker missing from `all` still has a place: its own position.
  const place = (g: SubjectGroup<T>) => Math.min(subjects.get(g.key!)?.position ?? Infinity, g.trackers[0].position);
  return [...groups.values()].sort((a, b) => (a.key === null ? -1 : b.key === null ? 1 : place(a) - place(b)));
}

export type Direction = 'up' | 'down';
export type OrderItem = { id: number; areaId: number; subject: string | null; archived: boolean; position: number };

const idsInOrder = (trackers: readonly OrderItem[]) => [...trackers].sort(byPosition).map((t) => t.id);

/** The active tracker `id` would swap with: its nearest neighbour in `dir` with the same area and subject key. */
function trackerNeighbour(trackers: readonly OrderItem[], id: number, dir: Direction): [OrderItem, OrderItem] | null {
  const self = trackers.find((t) => t.id === id);
  if (!self) return null;
  const key = subjectKey(self.subject);
  const group = trackers
    .filter((t) => t.areaId === self.areaId && subjectKey(t.subject) === key && (!t.archived || t === self))
    .sort(byPosition);
  const other = group[group.indexOf(self) + (dir === 'up' ? -1 : 1)];
  return other ? [self, other] : null;
}

export const canMoveTracker = (trackers: readonly OrderItem[], id: number, dir: Direction) =>
  trackerNeighbour(trackers, id, dir) !== null;

/** Every tracker id in order after moving `id` one step within its group; the current order if it can't move. */
export function moveTracker(trackers: readonly OrderItem[], id: number, dir: Direction): number[] {
  const pair = trackerNeighbour(trackers, id, dir);
  if (!pair) return idsInOrder(trackers);
  const [self, other] = pair;
  return idsInOrder(
    trackers.map((t) => (t === self ? { ...t, position: other.position } : t === other ? { ...t, position: self.position } : t)),
  );
}

/** The area's groups (no-subject first), and the indexes of `key` and the subject it would swap with. */
function subjectNeighbour(trackers: readonly OrderItem[], areaId: number, key: string, dir: Direction) {
  const groups = groupBySubject(trackers.filter((t) => t.areaId === areaId));
  const i = groups.findIndex((g) => g.key === key);
  if (i === -1) return null;
  const step = dir === 'up' ? -1 : 1;
  for (let j = i + step; j >= 0 && j < groups.length; j += step) {
    if (groups[j].key === null) return null; // the no-subject group never moves
    if (groups[j].trackers.some((t) => !t.archived)) return { groups, i, j };
  }
  return null;
}

export const canMoveSubject = (trackers: readonly OrderItem[], areaId: number, key: string, dir: Direction) =>
  subjectNeighbour(trackers, areaId, key, dir) !== null;

/**
 * Every tracker id in order after swapping subject `key` with its neighbour in `dir`; the current order if it
 * can't move. Blocks may interleave, so the area is rebuilt group by group and handed its own position numbers
 * back in the new order; other areas keep theirs.
 */
export function moveSubject(trackers: readonly OrderItem[], areaId: number, key: string, dir: Direction): number[] {
  const found = subjectNeighbour(trackers, areaId, key, dir);
  if (!found) return idsInOrder(trackers);
  const { groups, i, j } = found;
  [groups[i], groups[j]] = [groups[j], groups[i]];
  const slots = trackers.filter((t) => t.areaId === areaId).map((t) => t.position).sort((a, b) => a - b);
  const moved = new Map(groups.flatMap((g) => g.trackers).map((t, k) => [t.id, slots[k]]));
  return idsInOrder(trackers.map((t) => (moved.has(t.id) ? { ...t, position: moved.get(t.id)! } : t)));
}

/**
 * Minutes per period for each group, from per-tracker rows (the dashboard's `trackerMinutes`): subjects
 * first, the ungrouped group (key null) last. Groups with no time in any period are left out.
 */
export function minutesBySubject<T extends { id: number } & TimeRule>(
  groups: SubjectGroup<T>[],
  rows: { trackerId: number; periodStart: DateStr; minutes: number }[],
): { key: string | null; label: string | null; minutes: Record<DateStr, number> }[] {
  const ordered = [...groups.filter((g) => g.key !== null), ...groups.filter((g) => g.key === null)];
  return ordered
    .map((g) => {
      const ids = new Set(g.trackers.filter((t) => minutesFactor(t) !== null).map((t) => t.id));
      const minutes: Record<DateStr, number> = {};
      for (const r of rows) if (ids.has(r.trackerId)) minutes[r.periodStart] = (minutes[r.periodStart] ?? 0) + r.minutes;
      return { key: g.key, label: g.label, minutes };
    })
    .filter((g) => Object.values(g.minutes).some((m) => m > 0));
}
