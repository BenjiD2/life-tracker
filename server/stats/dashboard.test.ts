import { describe, expect, it } from 'vitest';
import { checkDaysInRange, ratingSeries, totalsPerBucket } from './dashboard';

const trackers = [
  { id: 1, kind: 'quantity' as const },
  { id: 2, kind: 'rating' as const },
  { id: 3, kind: 'check' as const },
];
const entries = [
  { trackerId: 1, date: '2026-09-27', value: 999 }, // before `from`, though its week overlaps the range
  { trackerId: 1, date: '2026-10-01', value: 30 },
  { trackerId: 1, date: '2026-10-02', value: 20 },
  { trackerId: 2, date: '2026-10-07', value: 4 },
  { trackerId: 2, date: '2026-10-01', value: 2 },
  { trackerId: 2, date: '2026-09-01', value: 5 },
  { trackerId: 3, date: '2026-09-01', value: 1 },
  { trackerId: 3, date: '2026-10-01', value: 1 },
  { trackerId: 3, date: '2026-10-08', value: 1 },
];

describe('totalsPerBucket', () => {
  it('sums quantity trackers per bucket, zero-filled; only days inside the range count', () =>
    expect(totalsPerBucket(trackers, entries, '2026-10-01', '2026-10-07', 'week')).toEqual([
      { trackerId: 1, periodStart: '2026-09-28', total: 50 },
      { trackerId: 1, periodStart: '2026-10-05', total: 0 },
    ]));
});

describe('ratingSeries', () => {
  it('rating entries inside the range, ascending by date', () =>
    expect(ratingSeries(trackers, entries, '2026-10-01', '2026-10-07')).toEqual([
      { trackerId: 2, date: '2026-10-01', value: 2 },
      { trackerId: 2, date: '2026-10-07', value: 4 },
    ]));
});

describe('checkDaysInRange', () => {
  it('days per check tracker inside the range; a tracker with none is left out', () => {
    expect(checkDaysInRange(trackers, entries, '2026-10-01', '2026-10-31')).toEqual([{ trackerId: 3, days: 2 }]);
    expect(checkDaysInRange(trackers, entries, '2026-01-01', '2026-01-31')).toEqual([]);
  });
});
