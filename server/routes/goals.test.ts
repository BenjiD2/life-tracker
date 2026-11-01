import { describe, expect, it } from 'vitest';
import { setup } from './testing';

async function fitness() {
  const s = setup('2026-10-15');
  const areaId = (await s.req('GET', '/api/areas')).body.find((a: { name: string }) => a.name === 'Fitness').id;
  const log = (tracker: string, date: string, value = 30) =>
    s.req('PUT', '/api/entries', { trackerId: s.trackerId(tracker), date, value });
  await log('Tennis', '2026-10-01');
  await log('Pickleball', '2026-10-01');
  await log('Pickleball', '2026-10-02');
  return { ...s, areaId };
}

describe('consistency goals', () => {
  it('counts area active days once per day across trackers, including archived ones', async () => {
    const { req, areaId, trackerId } = await fitness();
    const g = await req('POST', '/api/goals', { type: 'consistency', title: '12 days', areaId, period: 'month', targetDays: 12 });
    expect(g).toMatchObject({ status: 201, body: { created: '2026-10-15', items: [], progress: { current: 2, target: 12 } } });

    await req('PATCH', `/api/trackers/${trackerId('Pickleball')}`, { archived: true });
    const all = (await req('GET', '/api/goals')).body;
    expect(all[0].progress.current).toBe(2);
  });

  it('a goal scoped to one tracker only counts that tracker', async () => {
    const { req, areaId, trackerId } = await fitness();
    const g = await req('POST', '/api/goals', {
      type: 'consistency', title: 'tennis', areaId, period: 'month', targetDays: 4, scopeTrackerId: trackerId('Tennis'),
    });
    expect(g.body.progress.current).toBe(1);
  });

  it('a Reading-area goal counts days with pages read', async () => {
    const { req } = setup('2026-10-15');
    const reading = (await req('GET', '/api/areas')).body.find((a: { name: string }) => a.name === 'Reading').id;
    const book = (await req('POST', '/api/books', { title: 'b', author: 'a', totalPages: 300 })).body;
    await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-05', pageReached: 40 });
    await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-13', pageReached: 100 });
    const g = await req('POST', '/api/goals', { type: 'consistency', title: 'read', areaId: reading, period: 'month', targetDays: 5 });
    expect(g.body.progress.current).toBe(2);
  });

  it('targetDays 0 → 400', async () => {
    const { req, areaId } = await fitness();
    const r = await req('POST', '/api/goals', { type: 'consistency', title: 'x', areaId, period: 'week', targetDays: 0 });
    expect(r.status).toBe(400);
    expect(typeof r.body.error).toBe('string');
  });
});

describe('completion goals', () => {
  it('source tracker must be a quantity tracker', async () => {
    const { req, areaId, trackerId } = await fitness();
    const r = await req('POST', '/api/goals', {
      type: 'completion', title: 'x', areaId, source: 'tracker', target: 10, sourceTrackerId: trackerId('Mood'),
    });
    expect(r.status).toBe(400);
  });

  it('tracker source sums that tracker and reports pace against the deadline', async () => {
    const { req, areaId, trackerId } = await fitness();
    const r = await req('POST', '/api/goals', {
      type: 'completion', title: '1000 min', areaId, source: 'tracker', target: 1000,
      sourceTrackerId: trackerId('Pickleball'), deadline: '2026-11-14',
    });
    expect(r.body.progress).toMatchObject({ current: 60, target: 1000, expected: 0 });
  });

  it('deadline on or before today → 400; non-checklist without target → 400', async () => {
    const { req, areaId } = await fitness();
    expect((await req('POST', '/api/goals', {
      type: 'completion', title: 'x', areaId, source: 'books', target: 5, deadline: '2026-10-15',
    })).status).toBe(400);
    expect((await req('POST', '/api/goals', { type: 'completion', title: 'x', areaId, source: 'books' })).status).toBe(400);
  });

  it('PATCH updates target and title; DELETE removes the goal and its items', async () => {
    const { req, areaId } = await fitness();
    const g = (await req('POST', '/api/goals', { type: 'completion', title: 'books', areaId, source: 'books', target: 5 })).body;
    expect((await req('PATCH', `/api/goals/${g.id}`, { title: 'more books', target: 20 })).body)
      .toMatchObject({ title: 'more books', progress: { target: 20 } });
    expect((await req('DELETE', `/api/goals/${g.id}`)).status).toBe(204);
    expect((await req('GET', '/api/goals')).body).toEqual([]);
  });
});

describe('checklist goals', () => {
  it('target is the item count; ticking and unticking moves current', async () => {
    const { req, areaId } = await fitness();
    const g = (await req('POST', '/api/goals', { type: 'completion', title: 'HSK 1', areaId, source: 'checklist' })).body;
    const items = [];
    for (const label of ['a', 'b', 'c']) {
      const r = await req('POST', `/api/goals/${g.id}/items`, { label });
      expect(r.status).toBe(201);
      items.push(r.body);
    }
    expect((await req('PATCH', `/api/goal-items/${items[0].id}`, { done: true })).body.doneAt).toBe('2026-10-15');
    await req('PATCH', `/api/goal-items/${items[1].id}`, { done: true });
    let goal = (await req('GET', '/api/goals')).body[0];
    expect(goal.progress).toMatchObject({ current: 2, target: 3 });
    expect(goal.items).toHaveLength(3);

    await req('PATCH', `/api/goal-items/${items[1].id}`, { done: false });
    goal = (await req('GET', '/api/goals')).body[0];
    expect(goal.progress.current).toBe(1);

    expect((await req('DELETE', `/api/goal-items/${items[2].id}`)).status).toBe(204);
    expect((await req('GET', '/api/goals')).body[0].progress.target).toBe(2);
  });

  it('items can only be added to checklist goals', async () => {
    const { req, areaId } = await fitness();
    const g = (await req('POST', '/api/goals', { type: 'completion', title: 'b', areaId, source: 'books', target: 5 })).body;
    expect((await req('POST', `/api/goals/${g.id}/items`, { label: 'x' })).status).toBe(400);
  });
});
