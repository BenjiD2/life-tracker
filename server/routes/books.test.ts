import { describe, expect, it } from 'vitest';
import { setup } from './testing';

async function withBook(totalPages = 200) {
  const s = setup('2026-10-15');
  const book = (await s.req('POST', '/api/books', { title: 'SICP', author: 'Abelson', totalPages })).body;
  return { ...s, book };
}

describe('books', () => {
  it('POST creates a reading book started today; GET shows currentPage 0', async () => {
    const { req, book } = await withBook();
    expect(book).toMatchObject({ status: 'reading', started: '2026-10-15', finished: null, topic: null });
    expect((await req('GET', '/api/books')).body).toEqual([{ ...book, currentPage: 0 }]);
  });

  it('POST with totalPages 0 → 400', async () => {
    const { req } = setup();
    const r = await req('POST', '/api/books', { title: 'x', author: 'y', totalPages: 0 });
    expect(r.status).toBe(400);
    expect(typeof r.body.error).toBe('string');
  });

  it('PATCH status done sets finished to today; back to reading clears it', async () => {
    const { req, book } = await withBook();
    expect((await req('PATCH', `/api/books/${book.id}`, { status: 'done' })).body)
      .toMatchObject({ status: 'done', finished: '2026-10-15' });
    expect((await req('PATCH', `/api/books/${book.id}`, { status: 'reading' })).body)
      .toMatchObject({ status: 'reading', finished: null });
  });

  it('PATCH status done with an explicit finished date uses that date', async () => {
    const { req, book } = await withBook();
    expect((await req('PATCH', `/api/books/${book.id}`, { status: 'done', finished: '2026-10-10' })).body)
      .toMatchObject({ status: 'done', finished: '2026-10-10' });
  });

  it('PATCH finished on a book that will not be done → 400', async () => {
    const { req, book } = await withBook();
    expect((await req('PATCH', `/api/books/${book.id}`, { finished: '2026-10-10' })).status).toBe(400);
  });

  it('PATCH edits title, author, topic, and total pages', async () => {
    const { req, book } = await withBook(200);
    expect((await req('PATCH', `/api/books/${book.id}`, { title: 'SICP 2e', author: 'A & S', topic: 'cs', totalPages: 657 })).body)
      .toMatchObject({ title: 'SICP 2e', author: 'A & S', topic: 'cs', totalPages: 657 });
  });

  it('PATCH totalPages below a page already logged → 400', async () => {
    const { req, book } = await withBook(200);
    await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-01', pageReached: 150 });
    const r = await req('PATCH', `/api/books/${book.id}`, { totalPages: 120 });
    expect(r.status).toBe(400);
    expect(r.body.error).toContain('150');
    expect((await req('PATCH', `/api/books/${book.id}`, { totalPages: 150 })).status).toBe(200);
  });

  it('PATCH on a missing book → 404', async () => {
    const { req } = setup();
    expect((await req('PATCH', '/api/books/999', { title: 'x' })).status).toBe(404);
  });
});

describe('starting page (progress from before tracking)', () => {
  it('POST with startPage: currentPage starts there, and the first log only counts pages beyond it', async () => {
    const { req } = setup('2026-10-15');
    const book = (await req('POST', '/api/books', { title: 'b', author: 'a', totalPages: 400, startPage: 200 })).body;
    expect(book.startPage).toBe(200);
    expect((await req('GET', '/api/books')).body[0].currentPage).toBe(200);
    await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-14', pageReached: 230 });
    const d = (await req('GET', '/api/dashboard')).body;
    expect(d.pagesRead.at(-1)).toEqual({ periodStart: '2026-10-12', pages: 30 });
  });

  it('startPage defaults to 0', async () => {
    const { book } = await withBook();
    expect(book.startPage).toBe(0);
  });

  it('startPage above totalPages → 400 (POST and PATCH); totalPages below startPage → 400', async () => {
    const { req, book } = await withBook(200);
    expect((await req('POST', '/api/books', { title: 'x', author: 'y', totalPages: 100, startPage: 101 })).status).toBe(400);
    expect((await req('PATCH', `/api/books/${book.id}`, { startPage: 201 })).status).toBe(400);
    expect((await req('PATCH', `/api/books/${book.id}`, { startPage: 50 })).body.startPage).toBe(50);
    expect((await req('PATCH', `/api/books/${book.id}`, { totalPages: 40 })).status).toBe(400);
  });
});

describe('PUT /api/reading-log', () => {
  it('currentPage follows the latest date', async () => {
    const { req, book } = await withBook();
    await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-01', pageReached: 50 });
    await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-03', pageReached: 80 });
    expect((await req('GET', '/api/books')).body[0].currentPage).toBe(80);
  });

  it('saving twice on the same date keeps one row', async () => {
    const { req, db, book } = await withBook();
    await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-01', pageReached: 50 });
    const r = await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-01', pageReached: 60 });
    expect(r).toMatchObject({ status: 200, body: { row: { pageReached: 60 }, reachedEnd: false } });
    const { readingLog } = await import('../db/schema');
    expect(db.select().from(readingLog).all()).toHaveLength(1);
  });

  it('rejects pages above totalPages or below 0', async () => {
    const { req, book } = await withBook(200);
    expect((await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-01', pageReached: 201 })).status).toBe(400);
    expect((await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-01', pageReached: -1 })).status).toBe(400);
  });

  it('reachedEnd is true on the last page', async () => {
    const { req, book } = await withBook(200);
    expect((await req('PUT', '/api/reading-log', { bookId: book.id, date: '2026-10-01', pageReached: 200 })).body.reachedEnd)
      .toBe(true);
  });

  it('unknown book → 404', async () => {
    const { req } = setup();
    expect((await req('PUT', '/api/reading-log', { bookId: 999, date: '2026-10-01', pageReached: 1 })).status).toBe(404);
  });
});
