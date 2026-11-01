import { eq } from 'drizzle-orm';
import { Hono } from 'hono';
import { bookInput, bookPatch, readingLogInput } from '../../shared/schemas';
import type { BookWithPage, DateStr } from '../../shared/types';
import type { Db } from '../db/client';
import { books, readingLog } from '../db/schema';
import { latestPages } from '../stats/reading';
import { fail, paramId, validate } from './http';

export function bookRoutes(db: Db, today: () => DateStr) {
  const findBook = (id: number | null) => (id === null ? undefined : db.select().from(books).where(eq(books.id, id)).get());

  return new Hono()
    .get('/books', (c) => {
      const latest = latestPages(db.select().from(readingLog).all());
      const out: BookWithPage[] = db.select().from(books).all().map((b) => ({ ...b, currentPage: latest.get(b.id) ?? b.startPage }));
      return c.json(out);
    })
    .post('/books', validate('json', bookInput), (c) => {
      const input = c.req.valid('json');
      if ((input.startPage ?? 0) > input.totalPages) return fail(c, 400, `startPage must be between 0 and ${input.totalPages}`);
      const row = db
        .insert(books)
        .values({ ...input, startPage: input.startPage ?? 0, topic: input.topic ?? null, status: 'reading', started: today() })
        .returning()
        .get();
      return c.json(row, 201);
    })
    .patch('/books/:id', validate('json', bookPatch), (c) => {
      const book = findBook(paramId(c));
      if (!book) return fail(c, 404, 'Book not found');
      const patch = c.req.valid('json');
      if (Object.keys(patch).length === 0) return c.json(book);
      const totalPages = patch.totalPages ?? book.totalPages;
      if ((patch.startPage ?? book.startPage) > totalPages) return fail(c, 400, `startPage must be between 0 and ${totalPages}`);
      if (patch.totalPages !== undefined) {
        const highest = Math.max(0, ...db.select().from(readingLog).where(eq(readingLog.bookId, book.id)).all().map((l) => l.pageReached));
        if (patch.totalPages < highest) return fail(c, 400, `totalPages can't be below page ${highest}, which is already logged`);
      }
      const done = (patch.status ?? book.status) === 'done';
      if (patch.finished !== undefined && !done) return fail(c, 400, 'finished can only be set on a book marked done');
      const finished = done ? (patch.finished ?? book.finished ?? today()) : null;
      return c.json(db.update(books).set({ ...patch, finished }).where(eq(books.id, book.id)).returning().get());
    })
    .put('/reading-log', validate('json', readingLogInput), (c) => {
      const { finish, ...log } = c.req.valid('json');
      const book = findBook(log.bookId);
      if (!book) return fail(c, 404, 'Book not found');
      if (log.pageReached > book.totalPages) return fail(c, 400, `pageReached must be between 0 and ${book.totalPages}`);
      if (finish && log.pageReached !== book.totalPages) return fail(c, 400, 'finish only applies on the last page');
      const row = db.transaction((tx) => {
        if (finish) tx.update(books).set({ status: 'done', finished: log.date }).where(eq(books.id, book.id)).run();
        return tx
          .insert(readingLog)
          .values(log)
          .onConflictDoUpdate({ target: [readingLog.bookId, readingLog.date], set: { pageReached: log.pageReached } })
          .returning()
          .get();
      });
      return c.json(row);
    });
}
