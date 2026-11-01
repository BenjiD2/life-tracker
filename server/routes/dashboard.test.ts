import { describe, expect, it } from 'vitest';
import { setup } from './testing';

describe('GET /api/dashboard', () => {
  it('aggregates active days, weekly totals, mood, and pages per week', async () => {
    const { req, trackerId } = setup('2026-10-15');
    await req('PUT', '/api/entries', { trackerId: trackerId('Tennis'), date: '2026-10-01', value: 60 });
    await req('PUT', '/api/entries', { trackerId: trackerId('Pickleball'), date: '2026-10-01', value: 30 });
    await req('PUT', '/api/entries', { trackerId: trackerId('Pickleball'), date: '2026-10-02', value: 30 });
    await req('PUT', '/api/entries', { trackerId: trackerId('Mood'), date: '2026-10-14', value: 4 });
    const book = (await req('POST', '/api/books', { title: 'b', author: 'a', totalPages: 300 })).body;
    await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-05', pageReached: 40 });
    await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-13', pageReached: 100 });

    const d = (await req('GET', '/api/dashboard')).body;
    expect(d.today).toBe('2026-10-15');
    expect(d.areas.find((a: { area: { name: string } }) => a.area.name === 'Fitness').activeDates)
      .toEqual(['2026-10-01', '2026-10-02']);
    expect(d.areas.find((a: { area: { name: string } }) => a.area.name === 'Habits').activeDates).toEqual([]);

    expect(d.pagesPerWeek).toHaveLength(12);
    expect(d.pagesPerWeek.at(-1)).toEqual({ weekStart: '2026-10-12', pages: 60 });
    expect(d.pagesPerWeek.at(-2)).toEqual({ weekStart: '2026-10-05', pages: 40 });

    const tennis = d.weeklyTotals.filter((w: { trackerId: number }) => w.trackerId === trackerId('Tennis'));
    expect(tennis).toHaveLength(12);
    expect(tennis.find((w: { weekStart: string }) => w.weekStart === '2026-09-28').total).toBe(60);
    expect(d.weeklyTotals.some((w: { trackerId: number }) => w.trackerId === trackerId('Mood'))).toBe(false);

    expect(d.mood).toEqual([{ trackerId: trackerId('Mood'), date: '2026-10-14', value: 4 }]);
    expect(d.goals).toEqual([]);
  });
});
