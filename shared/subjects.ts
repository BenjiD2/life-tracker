import type { DateStr, Kind } from './types';

const MINUTE_UNITS = new Set(['minutes', 'minute', 'min', 'mins']);

export function isMinuteUnit(unit: string | null): boolean {
  return unit !== null && MINUTE_UNITS.has(unit.trim().toLowerCase());
}

/**
 * Minutes one unit of the tracker is worth, or null if it doesn't count toward time.
 * A set `minutesPerUnit` wins over a minute unit, so renaming the unit doesn't silently drop the multiplier.
 */
export function minutesFactor(t: { kind: Kind; unit: string | null; minutesPerUnit: number | null }): number | null {
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

/** Ungrouped trackers first (if any), then subjects by key. Trackers keep input order; the label is the lowest-id tracker's spelling. */
export function groupBySubject<T extends { id: number; subject: string | null }>(trackers: T[]): SubjectGroup<T>[] {
  const groups = new Map<string | null, { group: SubjectGroup<T>; labelId: number }>();
  for (const t of trackers) {
    const key = subjectKey(t.subject);
    const label = key === null ? null : t.subject!.trim();
    const g = groups.get(key);
    if (!g) groups.set(key, { group: { key, label, trackers: [t] }, labelId: t.id });
    else {
      g.group.trackers.push(t);
      if (t.id < g.labelId) [g.labelId, g.group.label] = [t.id, label];
    }
  }
  return [...groups.values()]
    .map((g) => g.group)
    .sort((a, b) => (a.key === null ? -1 : b.key === null ? 1 : a.key.localeCompare(b.key)));
}

/**
 * Minutes per period for each group, from per-tracker rows (the dashboard's `trackerMinutes`): subjects
 * first, the ungrouped group (key null) last. Groups with no time in any period are left out.
 */
export function minutesBySubject<T extends { id: number; kind: Kind; unit: string | null; minutesPerUnit: number | null }>(
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
