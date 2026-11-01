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

/**
 * Ungrouped trackers first (if any), then subjects by key. Trackers keep input order. The label is the spelling
 * of the group's lowest-id tracker in `all`, so hiding a tracker (an archived one, say) doesn't rename its subject.
 */
export function groupBySubject<T extends { id: number; subject: string | null }>(
  trackers: T[],
  all: readonly { id: number; subject: string | null }[] = trackers,
): SubjectGroup<T>[] {
  const labels = new Map<string, { id: number; label: string }>();
  for (const t of all) {
    const key = subjectKey(t.subject);
    if (key === null) continue;
    const held = labels.get(key);
    if (!held || t.id < held.id) labels.set(key, { id: t.id, label: t.subject!.trim() });
  }
  const groups = new Map<string | null, SubjectGroup<T>>();
  for (const t of trackers) {
    const key = subjectKey(t.subject);
    const group = groups.get(key);
    if (group) group.trackers.push(t);
    else groups.set(key, { key, label: key === null ? null : (labels.get(key)?.label ?? t.subject!.trim()), trackers: [t] });
  }
  return [...groups.values()].sort((a, b) => (a.key === null ? -1 : b.key === null ? 1 : a.key.localeCompare(b.key)));
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
