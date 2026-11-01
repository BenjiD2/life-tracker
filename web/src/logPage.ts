import type { Book, DateStr } from '../../shared/types';
import * as api from './api';

/** Saves a page position; on the last page, first asks whether to mark the book finished (spec §7). Both happen in one request. */
export function logPage(book: Book, date: DateStr, pageReached: number) {
  const finish = pageReached === book.totalPages && book.status !== 'done' && confirm(`Mark '${book.title}' as finished?`);
  return api.putReadingLog({ bookId: book.id, date, pageReached, finish });
}
