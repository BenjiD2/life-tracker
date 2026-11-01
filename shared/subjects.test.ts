import { describe, expect, it } from 'vitest';
import {
  canMoveSubject, canMoveTracker, groupBySubject, isMinuteUnit, minutesBySubject, minutesFactor, moveSubject, moveTracker,
  type OrderItem,
} from './subjects';

describe('isMinuteUnit', () => {
  it('accepts minute spellings, trimmed and case-insensitive', () => {
    for (const u of ['minutes', ' Min ', 'mins', 'minute']) expect(isMinuteUnit(u)).toBe(true);
  });
  it('rejects other units and no unit', () => {
    for (const u of ['lessons', 'hours', null]) expect(isMinuteUnit(u)).toBe(false);
  });
});

describe('minutesFactor', () => {
  const q = (unit: string | null, minutesPerUnit: number | null) => ({ kind: 'quantity' as const, unit, minutesPerUnit });
  it('a minute unit counts 1:1', () => expect(minutesFactor(q('minutes', null))).toBe(1));
  it('minutes per unit converts other units', () => {
    expect(minutesFactor(q('lessons', 40))).toBe(40);
    expect(minutesFactor(q('hours', 60))).toBe(60);
  });
  it('an unconverted non-minute unit is not counted', () => expect(minutesFactor(q('lessons', null))).toBeNull());
  it('minutes per unit overrides a minute unit (unit renamed after setting it)', () =>
    expect(minutesFactor(q('minutes', 40))).toBe(40));
  it('check and rating trackers are not counted', () => {
    expect(minutesFactor({ kind: 'check', unit: null, minutesPerUnit: null })).toBeNull();
    expect(minutesFactor({ kind: 'rating', unit: 'minutes', minutesPerUnit: null })).toBeNull();
  });
});

describe('groupBySubject', () => {
  it('groups case- and space-insensitively, ungrouped first, then subjects by lowest position; labels from the lowest id', () => {
    const groups = groupBySubject([
      { id: 3, subject: 'chinese', position: 5 },
      { id: 1, subject: ' Chinese ', position: 2 },
      { id: 2, subject: null, position: 9 },
      { id: 4, subject: 'C++', position: 3 },
      { id: 5, subject: '', position: 1 },
    ]);
    expect(groups.map((g) => ({ key: g.key, label: g.label, ids: g.trackers.map((t) => t.id) }))).toEqual([
      { key: null, label: null, ids: [5, 2] },
      { key: 'chinese', label: 'Chinese', ids: [1, 3] },
      { key: 'c++', label: 'C++', ids: [4] },
    ]);
  });
  it('no trackers → no groups', () => expect(groupBySubject([])).toEqual([]));
  it('the label can come from a tracker that is not shown, such as an archived one', () => {
    const shown = [{ id: 2, subject: 'Chinese', position: 2 }];
    const [group] = groupBySubject(shown, [{ id: 1, subject: 'CHINESE', position: 1 }, ...shown]);
    expect(group).toMatchObject({ key: 'chinese', label: 'CHINESE', trackers: shown });
  });
  it('orders subjects from the full list, so a hidden tracker can hold its subject\'s place', () => {
    // Alphabetical, or by the shown trackers alone, would put A first.
    const shown = [{ id: 1, subject: 'B', position: 5 }, { id: 2, subject: 'A', position: 3 }];
    const groups = groupBySubject(shown, [...shown, { id: 3, subject: 'b', position: 1 }]);
    expect(groups.map((g) => g.key)).toEqual(['b', 'a']);
  });
});

describe('minutesBySubject', () => {
  const t = (id: number, subject: string | null, unit: string, minutesPerUnit: number | null = null) =>
    ({ id, subject, position: id, kind: 'quantity' as const, unit, minutesPerUnit });
  const trackers = [t(1, null, 'minutes'), t(2, 'Chinese', 'minutes'), t(3, 'chinese', 'lessons', 40), t(4, 'C++', 'modules'), t(5, 'Art', 'minutes')];
  const rows = [
    { trackerId: 1, periodStart: '2026-10-05', minutes: 10 },
    { trackerId: 1, periodStart: '2026-10-12', minutes: 0 },
    { trackerId: 2, periodStart: '2026-10-05', minutes: 30 },
    { trackerId: 2, periodStart: '2026-10-12', minutes: 15 },
    { trackerId: 3, periodStart: '2026-10-05', minutes: 80 },
    { trackerId: 3, periodStart: '2026-10-12', minutes: 0 },
    { trackerId: 5, periodStart: '2026-10-05', minutes: 0 },
    { trackerId: 5, periodStart: '2026-10-12', minutes: 0 },
  ];

  it('sums each subject per period, subjects first and "no subject" last; subjects without time are left out', () =>
    expect(minutesBySubject(groupBySubject(trackers), rows)).toEqual([
      // Art logged no time in these periods; C++ has no time-counting tracker (modules, unconverted)
      { key: 'chinese', label: 'Chinese', minutes: { '2026-10-05': 110, '2026-10-12': 15 } },
      { key: null, label: null, minutes: { '2026-10-05': 10, '2026-10-12': 0 } },
    ]));
});

const item = (id: number, subject: string | null, position: number, extra: Partial<OrderItem> = {}): OrderItem =>
  ({ id, areaId: 1, subject, archived: false, position, ...extra });

describe('moveTracker', () => {
  const t = [
    item(1, null, 1), item(2, 'C', 2), item(3, 'C', 3, { archived: true }), item(4, 'C', 4), item(5, 'D', 5),
    item(6, 'C', 6, { areaId: 2 }),
  ];

  it('swaps with the nearest active tracker above in its group, skipping archived ones', () => {
    expect(moveTracker(t, 4, 'up')).toEqual([1, 4, 3, 2, 5, 6]);
    expect(canMoveTracker(t, 4, 'up')).toBe(true);
  });
  it('the top of a group does not move up', () => {
    expect(moveTracker(t, 2, 'up')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(canMoveTracker(t, 2, 'up')).toBe(false);
  });
  it('does not swap with a hidden archived tracker, or with other groups or areas', () => {
    expect(moveTracker(t, 4, 'down')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(canMoveTracker(t, 4, 'down')).toBe(false);
  });
  it('the no-subject group orders within itself only', () => {
    expect(moveTracker(t, 1, 'down')).toEqual([1, 2, 3, 4, 5, 6]);
    expect(canMoveTracker(t, 1, 'down')).toBe(false);
  });
});

describe('moveSubject', () => {
  // A and B interleave; C has only an archived tracker; area 2 also has an A.
  const t = [
    item(1, null, 1), item(2, 'A', 2), item(3, 'B', 3), item(4, 'A', 4, { archived: true }), item(5, 'B', 5),
    item(6, 'C', 6, { archived: true }), item(7, 'A', 7, { areaId: 2 }),
  ];

  it('swaps whole blocks, archived trackers included, keeping each block\'s order and other areas', () => {
    expect(moveSubject(t, 1, 'b', 'up')).toEqual([1, 3, 5, 2, 4, 6, 7]);
    expect(canMoveSubject(t, 1, 'b', 'up')).toBe(true);
  });
  it('can move down past a neighbour', () => expect(moveSubject(t, 1, 'a', 'down')).toEqual([1, 3, 5, 2, 4, 6, 7]));
  it('a subject cannot pass the no-subject group', () => {
    expect(moveSubject(t, 1, 'a', 'up')).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(canMoveSubject(t, 1, 'a', 'up')).toBe(false);
  });
  it('a subject with no active tracker is not a neighbour', () => {
    expect(moveSubject(t, 1, 'b', 'down')).toEqual([1, 2, 3, 4, 5, 6, 7]);
    expect(canMoveSubject(t, 1, 'b', 'down')).toBe(false);
  });
});
