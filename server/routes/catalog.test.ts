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
