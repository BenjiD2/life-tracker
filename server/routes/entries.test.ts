import { describe, expect, it } from 'vitest';
import { setup } from './testing';

describe('PUT /api/entries', () => {
  it('upserts: saving again for the same tracker and date overwrites', async () => {
    const { req, trackerId } = setup();
    const id = trackerId('Tennis');
    expect((await req('PUT', '/api/entries', { trackerId: id, date: '2026-10-15', value: 30 })).status).toBe(200);
    const second = await req('PUT', '/api/entries', { trackerId: id, date: '2026-10-15', value: 90 });
    expect(second).toMatchObject({ status: 200, body: { trackerId: id, date: '2026-10-15', value: 90 } });
    const list = await req('GET', '/api/entries?date=2026-10-15');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].value).toBe(90);
  });

  it('rating: accepts an integer 1–5, rejects 7 and 3.5', async () => {
    const { req, trackerId } = setup();
    const id = trackerId('Mood');
    expect((await req('PUT', '/api/entries', { trackerId: id, date: '2026-10-15', value: 4 })).status).toBe(200);
    for (const value of [7, 3.5]) {
      const r = await req('PUT', '/api/entries', { trackerId: id, date: '2026-10-15', value });
      expect(r.status).toBe(400);
      expect(r.body.error).toContain('1–5');
    }
  });

  it('check: accepts 1, rejects 2', async () => {
    const { req } = setup();
    const t = await req('POST', '/api/trackers', { areaId: 2, name: 'Meditate', kind: 'check' });
    expect((await req('PUT', '/api/entries', { trackerId: t.body.id, date: '2026-10-15', value: 1 })).status).toBe(200);
    expect((await req('PUT', '/api/entries', { trackerId: t.body.id, date: '2026-10-15', value: 2 })).status).toBe(400);
  });

  it('quantity: rejects a negative value', async () => {
    const { req, trackerId } = setup();
    const r = await req('PUT', '/api/entries', { trackerId: trackerId('Tennis'), date: '2026-10-15', value: -5 });
    expect(r.status).toBe(400);
    expect(typeof r.body.error).toBe('string');
  });

  it('unknown tracker → 404; impossible date → 400', async () => {
    const { req, trackerId } = setup();
    expect((await req('PUT', '/api/entries', { trackerId: 999, date: '2026-10-15', value: 1 })).status).toBe(404);
    expect((await req('PUT', '/api/entries', { trackerId: trackerId('Tennis'), date: '2026-02-30', value: 1 })).status)
      .toBe(400);
  });
});

describe('GET/DELETE /api/entries', () => {
  it('DELETE removes the row', async () => {
    const { req, trackerId } = setup();
    const id = trackerId('Tennis');
    await req('PUT', '/api/entries', { trackerId: id, date: '2026-10-15', value: 30 });
    expect((await req('DELETE', `/api/entries?trackerId=${id}&date=2026-10-15`)).status).toBe(204);
    expect((await req('GET', '/api/entries?date=2026-10-15')).body).toEqual([]);
  });

  it('GET with a bad date → 400', async () => {
    const { req } = setup();
    expect((await req('GET', '/api/entries?date=nope')).status).toBe(400);
  });
});
