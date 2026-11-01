import { describe, expect, it } from 'vitest';
import { groupBySubject, isMinuteUnit, minutesFactor } from './subjects';

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
  it('groups case- and space-insensitively, ungrouped first, labels from the lowest id', () => {
    const groups = groupBySubject([
      { id: 3, subject: 'chinese' },
      { id: 1, subject: ' Chinese ' },
      { id: 2, subject: null },
      { id: 4, subject: 'C++' },
      { id: 5, subject: '' },
    ]);
    expect(groups.map((g) => ({ key: g.key, label: g.label, ids: g.trackers.map((t) => t.id) }))).toEqual([
      { key: null, label: null, ids: [2, 5] },
      { key: 'c++', label: 'C++', ids: [4] },
      { key: 'chinese', label: 'Chinese', ids: [3, 1] },
    ]);
  });
  it('no trackers → no groups', () => expect(groupBySubject([])).toEqual([]));
});
