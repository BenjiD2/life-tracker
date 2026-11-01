import { describe, expect, it } from 'vitest';
import { setup } from './testing';

type Row = { trackerId: number; periodStart: string; total: number };
const area = (d: { areas: { area: { name: string }; activeDates: string[] }[] }, name: string) =>
  d.areas.find((a) => a.area.name === name)!.activeDates;

async function seeded() {
  const s = setup('2026-10-15');
  const { req, trackerId } = s;
  await req('PUT', '/api/entries', { trackerId: trackerId('Tennis'), date: '2026-06-10', value: 45 }); // outside default range
  await req('PUT', '/api/entries', { trackerId: trackerId('Tennis'), date: '2026-10-01', value: 60 });
  await req('PUT', '/api/entries', { trackerId: trackerId('Pickleball'), date: '2026-10-01', value: 30 });
  await req('PUT', '/api/entries', { trackerId: trackerId('Pickleball'), date: '2026-10-02', value: 30 });
  await req('PUT', '/api/entries', { trackerId: trackerId('Mood'), date: '2026-06-11', value: 2 });
  await req('PUT', '/api/entries', { trackerId: trackerId('Mood'), date: '2026-10-14', value: 4 });
  const book = (await req('POST', '/api/books', { title: 'b', author: 'a', totalPages: 300 })).body;
  await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-05', pageReached: 40 });
  await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-13', pageReached: 100 });
  await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-14', pageReached: 90 }); // correction: 0 pages
  return s;
}

describe('GET /api/dashboard (12 weeks)', () => {
  it('aggregates active days, weekly totals, mood, and pages per week', async () => {
    const { req, trackerId } = await seeded();
    const d = (await req('GET', '/api/dashboard?from=2026-07-27&to=2026-10-15')).body;
    expect(d).toMatchObject({ today: '2026-10-15', from: '2026-07-27', to: '2026-10-15', bucket: 'week' });
    expect(area(d, 'Fitness')).toEqual(['2026-10-01', '2026-10-02']); // June is outside the range
    expect(d.trackers.map((t: { name: string }) => t.name)).toContain('Tennis');
    expect(area(d, 'Habits')).toEqual([]);
    // Reading has no trackers: its active days are days with pages read (a downward correction isn't reading)
    expect(area(d, 'Reading')).toEqual(['2026-10-05', '2026-10-13']);

    expect(d.pagesRead).toHaveLength(12);
    expect(d.pagesRead.at(-1)).toEqual({ periodStart: '2026-10-12', pages: 60 });
    expect(d.pagesRead.at(-2)).toEqual({ periodStart: '2026-10-05', pages: 40 });

    const tennis = d.trackerTotals.filter((w: Row) => w.trackerId === trackerId('Tennis'));
    expect(tennis).toHaveLength(12);
    expect(tennis.find((w: Row) => w.periodStart === '2026-09-28').total).toBe(60);
    expect(d.trackerTotals.some((w: Row) => w.trackerId === trackerId('Mood'))).toBe(false);

    expect(d.mood).toEqual([{ trackerId: trackerId('Mood'), date: '2026-10-14', value: 4 }]);
    expect(d.goals).toEqual([]);
  });
});

describe('GET /api/dashboard?from=&to=', () => {
  it('a long range switches to monthly buckets and includes older data', async () => {
    const { req, trackerId } = await seeded();
    const d = (await req('GET', '/api/dashboard?from=2026-01-01&to=2026-10-15')).body;
    expect(d).toMatchObject({ from: '2026-01-01', to: '2026-10-15', bucket: 'month' });
    expect(area(d, 'Fitness')).toEqual(['2026-06-10', '2026-10-01', '2026-10-02']);
    const tennis = d.trackerTotals.filter((w: Row) => w.trackerId === trackerId('Tennis'));
    expect(tennis.map((w: Row) => w.periodStart)).toHaveLength(10);
    expect(tennis.find((w: Row) => w.periodStart === '2026-06-01').total).toBe(45);
    expect(tennis.find((w: Row) => w.periodStart === '2026-10-01').total).toBe(60);
    expect(d.pagesRead.find((p: { periodStart: string }) => p.periodStart === '2026-10-01').pages).toBe(100);
    expect(d.mood.map((m: { date: string }) => m.date)).toEqual(['2026-06-11', '2026-10-14']);
  });

  it('a short range only counts days inside it, even within a partial first week', async () => {
    const { req, trackerId } = await seeded();
    const d = (await req('GET', '/api/dashboard?from=2026-10-02&to=2026-10-15')).body;
    expect(d.bucket).toBe('week');
    expect(area(d, 'Fitness')).toEqual(['2026-10-02']);
    const pickleball = d.trackerTotals.filter((w: Row) => w.trackerId === trackerId('Pickleball'));
    expect(pickleball.find((w: Row) => w.periodStart === '2026-09-28').total).toBe(30); // 10-01 excluded
  });

  it('pages read on the range edge still measure from the previous log before the range', async () => {
    const { req } = await seeded();
    const d = (await req('GET', '/api/dashboard?from=2026-10-13&to=2026-10-15')).body;
    expect(d.pagesRead).toEqual([{ periodStart: '2026-10-12', pages: 60 }]); // 100 − 40, not 100 − 0
  });

  it('rejects a bad date, from after to, one bound, or no range (400)', async () => {
    const { req } = await seeded();
    expect((await req('GET', '/api/dashboard?from=2026-02-30&to=2026-10-15')).status).toBe(400);
    expect((await req('GET', '/api/dashboard?from=2026-10-15&to=2026-10-01')).status).toBe(400);
    expect((await req('GET', '/api/dashboard?from=2026-10-01')).status).toBe(400);
    expect((await req('GET', '/api/dashboard')).status).toBe(400);
  });
});

describe('GET /api/dashboard trackerMinutes', () => {
  type MinRow = { trackerId: number; periodStart: string; minutes: number };
  const at = (d: { trackerMinutes: MinRow[] }, id: number, week: string) =>
    d.trackerMinutes.find((r) => r.trackerId === id && r.periodStart === week)?.minutes;

  it('counts minute trackers as-is and re-estimates history when minutes per unit changes', async () => {
    const { req, trackerId } = await seeded();
    const before = (await req('GET', '/api/dashboard?from=2026-07-27&to=2026-10-15')).body;
    expect(at(before, trackerId('Tennis'), '2026-09-28')).toBe(60);
    expect(before.trackerMinutes.some((r: MinRow) => r.trackerId === trackerId('Mood'))).toBe(false);

    await req('PATCH', `/api/trackers/${trackerId('Tennis')}`, { minutesPerUnit: 2 });
    const after = (await req('GET', '/api/dashboard?from=2026-07-27&to=2026-10-15')).body;
    expect(at(after, trackerId('Tennis'), '2026-09-28')).toBe(120);
  });
});

describe('GET /api/dashboard checkDays', () => {
  it('counts days per check tracker inside the range', async () => {
    const { req } = setup('2026-10-15');
    const t = (await req('POST', '/api/trackers', { areaId: 2, name: 'Meditate', kind: 'check' })).body;
    for (const date of ['2026-06-01', '2026-10-01', '2026-10-02']) await req('PUT', '/api/entries', { trackerId: t.id, date, value: 1 });
    const d = (await req('GET', '/api/dashboard?from=2026-09-01&to=2026-10-15')).body;
    expect(d.checkDays).toEqual([{ trackerId: t.id, days: 2 }]);
  });
});
