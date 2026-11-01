import { describe, expect, it } from 'vitest';
import { groupBySubject, isMinuteUnit, minutesBySubject, minutesFactor } from './subjects';

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
  it('the label can come from a tracker that is not shown, such as an archived one', () => {
    const shown = [{ id: 2, subject: 'Chinese' }];
    const [group] = groupBySubject(shown, [{ id: 1, subject: 'CHINESE' }, ...shown]);
    expect(group).toMatchObject({ key: 'chinese', label: 'CHINESE', trackers: shown });
  });
});

describe('minutesBySubject', () => {
  const t = (id: number, subject: string | null, unit: string, minutesPerUnit: number | null = null) =>
    ({ id, subject, kind: 'quantity' as const, unit, minutesPerUnit });
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
