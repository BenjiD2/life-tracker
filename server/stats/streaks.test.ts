import { describe, expect, it } from 'vitest';
import { activeDates, countInRange, periodStreak } from './streaks';

describe('activeDates', () => {
  it('counts a day once when several trackers logged it, and ignores other trackers', () => {
    expect(activeDates([
      { trackerId: 1, date: '2026-10-01' }, { trackerId: 2, date: '2026-10-01' },
      { trackerId: 3, date: '2026-10-02' },
    ], new Set([1, 2]))).toEqual(new Set(['2026-10-01']));
  });
});

describe('countInRange', () => {
  it('is inclusive at both ends', () => {
    expect(countInRange(new Set(['2026-09-30', '2026-10-01', '2026-10-31', '2026-11-01']),
      '2026-10-01', '2026-10-31')).toBe(2);
  });
});

describe('periodStreak', () => {
  // month, target 2, today mid-October
  const base = ['2026-08-03', '2026-08-10', '2026-09-01', '2026-09-02', '2026-10-01'];

  it('an unfinished, unmet current period does not break the streak', () => {
    expect(periodStreak(new Set(base), 'month', 2, '2026-10-15')).toBe(2);
  });
  it('an unfinished current period that is already met counts', () => {
    expect(periodStreak(new Set([...base, '2026-10-02']), 'month', 2, '2026-10-15')).toBe(3);
  });
  it('stops at the first failed completed period', () => {
    expect(periodStreak(new Set(['2026-09-01', '2026-10-01', '2026-10-02']), 'month', 2, '2026-10-15')).toBe(1);
  });
  it('is 0 with no data', () => {
    expect(periodStreak(new Set(), 'month', 2, '2026-10-15')).toBe(0);
  });
  it('returns 0 for a non-positive target instead of looping forever', () => {
    expect(periodStreak(new Set(['2026-10-01']), 'month', 0, '2026-10-15')).toBe(0);
  });
  it('walks weeks back across the Sunday→Monday rollover', () => {
    // today is Sunday 2026-11-01; weeks 10-19..10-25 and 10-26..11-01 are each met
    expect(periodStreak(new Set(['2026-10-20', '2026-10-26']), 'week', 1, '2026-11-01')).toBe(2);
  });
});
