import type {
  AreaInput, AreaPatch, BookInput, BookPatch, EntryInput, GoalInput, GoalItemInput, GoalItemPatch, GoalPatch,
  ReadingLogInput, TrackerInput, TrackerPatch,
} from '../../shared/schemas';
import type {
  Area, Book, BookWithPage, DashboardData, DateStr, Entry, GoalItem, GoalWithProgress, ReadingLogResult, Tracker,
} from '../../shared/types';

export class ApiError extends Error {
  constructor(message: string, readonly status: number) {
    super(message);
  }
}

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new ApiError(data.error ?? res.statusText, res.status);
  return data as T;
}

const q = (params: Record<string, string | number>) => new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));

export const getAreas = () => call<Area[]>('GET', '/areas');
export const createArea = (input: AreaInput) => call<Area>('POST', '/areas', input);
export const updateArea = (id: number, patch: AreaPatch) => call<Area>('PATCH', `/areas/${id}`, patch);
export const deleteArea = (id: number) => call<void>('DELETE', `/areas/${id}`);

export const getTrackers = () => call<Tracker[]>('GET', '/trackers');
export const createTracker = (input: TrackerInput) => call<Tracker>('POST', '/trackers', input);
export const updateTracker = (id: number, patch: TrackerPatch) => call<Tracker>('PATCH', `/trackers/${id}`, patch);

export const getEntries = (date: DateStr) => call<Entry[]>('GET', `/entries?${q({ date })}`);
export const putEntry = (input: EntryInput) => call<Entry>('PUT', '/entries', input);
export const deleteEntry = (trackerId: number, date: DateStr) => call<void>('DELETE', `/entries?${q({ trackerId, date })}`);

export const getBooks = () => call<BookWithPage[]>('GET', '/books');
export const createBook = (input: BookInput) => call<Book>('POST', '/books', input);
export const updateBook = (id: number, patch: BookPatch) => call<Book>('PATCH', `/books/${id}`, patch);
export const putReadingLog = (input: ReadingLogInput) => call<ReadingLogResult>('PUT', '/reading-log', input);

export const getGoals = () => call<GoalWithProgress[]>('GET', '/goals');
export const createGoal = (input: GoalInput) => call<GoalWithProgress>('POST', '/goals', input);
export const updateGoal = (id: number, patch: GoalPatch) => call<GoalWithProgress>('PATCH', `/goals/${id}`, patch);
export const deleteGoal = (id: number) => call<void>('DELETE', `/goals/${id}`);
export const createGoalItem = (goalId: number, input: GoalItemInput) => call<GoalItem>('POST', `/goals/${goalId}/items`, input);
export const updateGoalItem = (id: number, patch: GoalItemPatch) => call<GoalItem>('PATCH', `/goal-items/${id}`, patch);
export const deleteGoalItem = (id: number) => call<void>('DELETE', `/goal-items/${id}`);

/** Without a range the server uses its default (the last 12 weeks). */
export const getDashboard = (range?: { from: DateStr; to: DateStr }) =>
  call<DashboardData>('GET', range ? `/dashboard?${q(range)}` : '/dashboard');

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

/**
 * Saves a page position; if it reached the last page, asks whether to mark the book finished (spec §7).
 */
export async function logPage(book: Book, date: DateStr, pageReached: number): Promise<void> {
  const { reachedEnd } = await putReadingLog({ bookId: book.id, date, pageReached });
  if (reachedEnd && book.status !== 'done' && confirm(`Mark '${book.title}' as finished?`)) {
    await updateBook(book.id, { status: 'done', finished: date });
  }
}
