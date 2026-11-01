import { describe, expect, it } from 'vitest';
import { latestPages, pagesPerBucket, pagesReadByDate } from './reading';

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

  it("measures a book's first log from its starting page, not 0", () => {
    const r = pagesReadByDate(
      [{ bookId: 1, date: '2026-10-01', pageReached: 210 }, { bookId: 2, date: '2026-10-01', pageReached: 15 }],
      new Map([[1, 200]]), // book 2 has no starting page → 0
    );
    expect(r.get('2026-10-01')).toBe(25);
  });

  it('is empty for no logs', () => {
    expect(pagesReadByDate([]).size).toBe(0);
  });
});

describe('pagesPerBucket', () => {
  it('sums pages per bucket, zero-filled, and drops dates outside the range', () => {
    const pages = new Map([['2026-09-30', 7], ['2026-10-01', 10], ['2026-10-02', 5], ['2026-10-15', 99]]);
    expect(pagesPerBucket(pages, '2026-10-01', '2026-10-07', 'week')).toEqual([
      { periodStart: '2026-09-28', pages: 15 },
      { periodStart: '2026-10-05', pages: 0 },
    ]);
  });
});

describe('latestPages', () => {
  it('each book maps to the page of its latest date, whatever the log order', () => {
    const latest = latestPages([
      { bookId: 1, date: '2026-10-03', pageReached: 80 },
      { bookId: 1, date: '2026-10-01', pageReached: 90 },
      { bookId: 2, date: '2026-10-02', pageReached: 5 },
    ]);
    expect([...latest]).toEqual([[1, 80], [2, 5]]);
  });
});
