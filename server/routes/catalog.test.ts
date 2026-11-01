import { describe, expect, it } from 'vitest';
import { setup } from './testing';

describe('areas', () => {
  it('POST creates, PATCH renames, GET lists', async () => {
    const { req } = setup();
    const created = await req('POST', '/api/areas', { name: 'Music', color: '#123456' });
    expect(created).toMatchObject({ status: 201, body: { name: 'Music', color: '#123456' } });
    const patched = await req('PATCH', `/api/areas/${created.body.id}`, { name: 'Piano' });
    expect(patched).toMatchObject({ status: 200, body: { name: 'Piano', color: '#123456' } });
    expect((await req('GET', '/api/areas')).body).toHaveLength(6);
  });

  it('POST without a name → 400 with an error string', async () => {
    const { req } = setup();
    const r = await req('POST', '/api/areas', { color: '#123456' });
    expect(r.status).toBe(400);
    expect(typeof r.body.error).toBe('string');
  });

  it('DELETE refuses an area that still has trackers (409), allows an empty one (204)', async () => {
    const { req } = setup();
    const fitness = (await req('GET', '/api/areas')).body.find((a: { name: string }) => a.name === 'Fitness');
    const refused = await req('DELETE', `/api/areas/${fitness.id}`);
    expect(refused.status).toBe(409);
    expect(typeof refused.body.error).toBe('string');
    const empty = await req('POST', '/api/areas', { name: 'Empty', color: '#000000' });
    expect((await req('DELETE', `/api/areas/${empty.body.id}`)).status).toBe(204);
  });

  it('PATCH or DELETE on a missing area → 404', async () => {
    const { req } = setup();
    expect((await req('PATCH', '/api/areas/999', { name: 'x' })).status).toBe(404);
    expect((await req('DELETE', '/api/areas/999')).status).toBe(404);
  });
});

describe('deleting an area whose trackers are archived', () => {
  it('409 names the trackers, says they are archived, and does not suggest deleting them', async () => {
    const { req } = setup();
    const area = (await req('POST', '/api/areas', { name: 'Music', color: '#123456' })).body;
    const t = (await req('POST', '/api/trackers', { areaId: area.id, name: 'Piano', kind: 'check' })).body;
    await req('PATCH', `/api/trackers/${t.id}`, { archived: true });
    const r = await req('DELETE', `/api/areas/${area.id}`);
    expect(r.status).toBe(409);
    expect(r.body.error).toContain('Piano (archived)');
    expect(r.body.error).not.toContain('delete them');
  });
});

describe('moving a tracker that a goal is scoped to', () => {
  it('is refused (409) and names the goal', async () => {
    const { req, trackerId } = setup();
    const areas = (await req('GET', '/api/areas')).body;
    const fitness = areas.find((a: { name: string }) => a.name === 'Fitness').id;
    const habits = areas.find((a: { name: string }) => a.name === 'Habits').id;
    await req('POST', '/api/goals', {
      type: 'consistency', title: 'Tennis twice a week', areaId: fitness, period: 'week', targetDays: 2, scopeTrackerId: trackerId('Tennis'),
    });
    const r = await req('PATCH', `/api/trackers/${trackerId('Tennis')}`, { areaId: habits });
    expect(r.status).toBe(409);
    expect(r.body.error).toContain('Tennis twice a week');
    // moving an unscoped tracker still works
    expect((await req('PATCH', `/api/trackers/${trackerId('Lifting')}`, { areaId: habits })).status).toBe(200);
  });
});

describe('trackers', () => {
  it('POST creates a tracker; unknown area → 404; bad kind → 400', async () => {
    const { req } = setup();
    const t = await req('POST', '/api/trackers', { areaId: 2, name: 'Meditate', kind: 'check' });
    expect(t).toMatchObject({ status: 201, body: { name: 'Meditate', kind: 'check', unit: null, archived: false } });
    expect((await req('POST', '/api/trackers', { areaId: 999, name: 'x', kind: 'check' })).status).toBe(404);
    expect((await req('POST', '/api/trackers', { areaId: 2, name: 'x', kind: 'bogus' })).status).toBe(400);
  });

  it('PATCH refuses to change kind (400)', async () => {
    const { req, trackerId } = setup();
    const r = await req('PATCH', `/api/trackers/${trackerId('Tennis')}`, { kind: 'rating' });
    expect(r.status).toBe(400);
    expect(typeof r.body.error).toBe('string');
  });

  it('archiving keeps the tracker in GET /api/trackers', async () => {
    const { req, trackerId } = setup();
    const id = trackerId('Tennis');
    expect((await req('PATCH', `/api/trackers/${id}`, { archived: true })))
      .toMatchObject({ status: 200, body: { id, archived: true } });
    const all = (await req('GET', '/api/trackers')).body;
    expect(all.find((t: { id: number }) => t.id === id)).toMatchObject({ archived: true });
  });
});

describe('tracker subject and minutes per unit', () => {
  const learning = async (req: ReturnType<typeof setup>['req']) =>
    (await req('GET', '/api/areas')).body.find((a: { name: string }) => a.name === 'Learning').id;

  it('POST stores a trimmed subject and minutes per unit; both default to null', async () => {
    const { req } = setup();
    const areaId = await learning(req);
    const r = await req('POST', '/api/trackers', { areaId, name: 'Chinese lessons', kind: 'quantity', unit: 'lessons', subject: ' Chinese ', minutesPerUnit: 40 });
    expect(r).toMatchObject({ status: 201, body: { subject: 'Chinese', minutesPerUnit: 40 } });
    const plain = await req('POST', '/api/trackers', { areaId, name: 'Flashcards', kind: 'quantity', unit: 'minutes' });
    expect(plain.body).toMatchObject({ subject: null, minutesPerUnit: null });
  });

  it('PATCH clears with an empty subject or null minutes per unit', async () => {
    const { req } = setup();
    const t = (await req('POST', '/api/trackers', { areaId: await learning(req), name: 'L', kind: 'quantity', unit: 'lessons', subject: 'Chinese', minutesPerUnit: 40 })).body;
    expect((await req('PATCH', `/api/trackers/${t.id}`, { subject: '  ' })).body.subject).toBeNull();
    expect((await req('PATCH', `/api/trackers/${t.id}`, { minutesPerUnit: null })).body.minutesPerUnit).toBeNull();
  });

  it('minutes per unit on a check or rating tracker → 400; null is accepted', async () => {
    const { req, trackerId } = setup();
    const check = await req('POST', '/api/trackers', { areaId: await learning(req), name: 'Did it', kind: 'check', minutesPerUnit: 30 });
    expect(check.status).toBe(400);
    expect(typeof check.body.error).toBe('string');
    expect((await req('PATCH', `/api/trackers/${trackerId('Mood')}`, { minutesPerUnit: 10 })).status).toBe(400);
    expect((await req('PATCH', `/api/trackers/${trackerId('Mood')}`, { minutesPerUnit: null })).status).toBe(200);
  });

  it('zero or negative minutes per unit → 400', async () => {
    const { req, trackerId } = setup();
    expect((await req('PATCH', `/api/trackers/${trackerId('Tennis')}`, { minutesPerUnit: 0 })).status).toBe(400);
    expect((await req('PATCH', `/api/trackers/${trackerId('Tennis')}`, { minutesPerUnit: -5 })).status).toBe(400);
  });
});

describe('errors', () => {
  it('malformed JSON → 400 with an error string, not 500', async () => {
    const { app } = setup();
    const res = await app.request('/api/areas', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{oops' });
    expect(res.status).toBe(400);
    expect(typeof (await res.json()).error).toBe('string');
  });

  it('PATCH /areas with a bad colour → 400', async () => {
    const { req } = setup();
    const area = (await req('GET', '/api/areas')).body[0];
    const r = await req('PATCH', `/api/areas/${area.id}`, { color: 'red' });
    expect(r.status).toBe(400);
    expect(typeof r.body.error).toBe('string');
  });
});
