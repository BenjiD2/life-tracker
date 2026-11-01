import { describe, expect, it } from 'vitest';
import { minutesPerBucket } from './time';

const q = (id: number, unit: string, minutesPerUnit: number | null) => ({ id, kind: 'quantity' as const, unit, minutesPerUnit });
const A = q(1, 'minutes', null);
const B = q(2, 'lessons', 40);
const C = q(3, 'lessons', null);
const D = q(4, 'minutes', 40);

const entries = [
  { trackerId: 1, date: '2026-09-27', value: 999 }, // before `from`, though its week overlaps the range
  { trackerId: 1, date: '2026-10-01', value: 30 },
  { trackerId: 1, date: '2026-10-02', value: 20 },
  { trackerId: 2, date: '2026-10-06', value: 2 },
  { trackerId: 3, date: '2026-10-06', value: 5 },
  { trackerId: 4, date: '2026-10-13', value: 1 },
];

describe('minutesPerBucket', () => {
  const rows = minutesPerBucket([A, B, C, D], entries, '2026-10-01', '2026-10-15', 'week');
  const of = (id: number) => rows.filter((r) => r.trackerId === id).map((r) => [r.periodStart, r.minutes]);

  it('minute units count as-is; only days inside the range count', () =>
    expect(of(1)).toEqual([['2026-09-28', 50], ['2026-10-05', 0], ['2026-10-12', 0]]));
  it('minutes per unit converts, and overrides a minute unit', () => {
    expect(of(2)).toEqual([['2026-09-28', 0], ['2026-10-05', 80], ['2026-10-12', 0]]);
    expect(of(4)).toEqual([['2026-09-28', 0], ['2026-10-05', 0], ['2026-10-12', 40]]);
  });
  it('an unconverted non-minute tracker is left out', () => expect(of(3)).toEqual([]));
  it('rows follow tracker order, then bucket', () =>
    expect(rows.map((r) => r.trackerId)).toEqual([1, 1, 1, 2, 2, 2, 4, 4, 4]));
});
