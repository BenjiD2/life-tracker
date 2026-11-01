import { describe, expect, it } from 'vitest';
import { pagesReadByDate } from './reading';

describe('pagesReadByDate', () => {
  it('diffs page positions per book and sums across books per date', () => {
    const r = pagesReadByDate([
      { bookId: 1, date: '2026-10-03', pageReached: 50 },
      { bookId: 1, date: '2026-10-01', pageReached: 20 }, // first log: 20 − 0
      { bookId: 2, date: '2026-10-03', pageReached: 10 },
      { bookId: 1, date: '2026-10-07', pageReached: 45 }, // correction downward → 0, not −5
    ]);
    expect(r.get('2026-10-01')).toBe(20);
    expect(r.get('2026-10-03')).toBe(40); // 30 (book 1, gap since 10-01) + 10 (book 2)
    expect(r.get('2026-10-07')).toBe(0);
  });

  it('is empty for no logs', () => {
    expect(pagesReadByDate([]).size).toBe(0);
  });
});
