import { describe, expect, it } from 'vitest';
import { bucketFor, bucketStarts } from './buckets';

describe('bucketFor', () => {
  it('uses weeks up to 26 weeks, months beyond', () => {
    expect(bucketFor('2026-05-01', '2026-10-30')).toBe('week'); // 182 days
    expect(bucketFor('2026-04-01', '2026-10-31')).toBe('month');
  });
});

describe('bucketStarts', () => {
  it('lists Mondays covering the range, starting at the week containing `from`', () => {
    expect(bucketStarts('2026-10-01', '2026-10-15', 'week')).toEqual(['2026-09-28', '2026-10-05', '2026-10-12']);
  });
  it('lists month starts covering the range, across a year boundary', () => {
    expect(bucketStarts('2025-11-20', '2026-02-03', 'month')).toEqual(['2025-11-01', '2025-12-01', '2026-01-01', '2026-02-01']);
  });
  it('a single-day range has one bucket', () => {
    expect(bucketStarts('2026-10-15', '2026-10-15', 'week')).toEqual(['2026-10-12']);
  });
});
