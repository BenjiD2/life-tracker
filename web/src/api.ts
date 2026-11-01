import type {
  AreaInput, AreaPatch, BookInput, BookPatch, EntryInput, GoalInput, GoalItemInput, GoalItemPatch, GoalPatch,
  ReadingLogInput, TrackerInput, TrackerPatch,
} from '../../shared/schemas';
import type {
  Area, Book, BookWithPage, DashboardData, DateStr, Entry, GoalItem, GoalWithProgress, ReadingLogRow, Tracker,
} from '../../shared/types';

async function call<T>(method: string, path: string, body?: unknown): Promise<T> {
  const res = await fetch(`/api${path}`, {
    method,
    headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  if (res.status === 204) return undefined as T;
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data as T;
}

const searchParams = (params: Record<string, string | number>) => new URLSearchParams(Object.entries(params).map(([k, v]) => [k, String(v)]));

export const getAreas = () => call<Area[]>('GET', '/areas');
export const createArea = (input: AreaInput) => call<Area>('POST', '/areas', input);
export const updateArea = (id: number, patch: AreaPatch) => call<Area>('PATCH', `/areas/${id}`, patch);
export const deleteArea = (id: number) => call<void>('DELETE', `/areas/${id}`);

export const getTrackers = () => call<Tracker[]>('GET', '/trackers');
export const createTracker = (input: TrackerInput) => call<Tracker>('POST', '/trackers', input);
export const updateTracker = (id: number, patch: TrackerPatch) => call<Tracker>('PATCH', `/trackers/${id}`, patch);

export const getEntries = (date: DateStr) => call<Entry[]>('GET', `/entries?${searchParams({ date })}`);
export const putEntry = (input: EntryInput) => call<Entry>('PUT', '/entries', input);
export const deleteEntry = (trackerId: number, date: DateStr) => call<void>('DELETE', `/entries?${searchParams({ trackerId, date })}`);

export const getBooks = () => call<BookWithPage[]>('GET', '/books');
export const createBook = (input: BookInput) => call<Book>('POST', '/books', input);
export const updateBook = (id: number, patch: BookPatch) => call<Book>('PATCH', `/books/${id}`, patch);
export const putReadingLog = (input: ReadingLogInput) => call<ReadingLogRow>('PUT', '/reading-log', input);

export const getGoals = () => call<GoalWithProgress[]>('GET', '/goals');
export const createGoal = (input: GoalInput) => call<GoalWithProgress>('POST', '/goals', input);
export const updateGoal = (id: number, patch: GoalPatch) => call<GoalWithProgress>('PATCH', `/goals/${id}`, patch);
export const deleteGoal = (id: number) => call<void>('DELETE', `/goals/${id}`);
export const createGoalItem = (goalId: number, input: GoalItemInput) => call<GoalItem>('POST', `/goals/${goalId}/items`, input);
export const updateGoalItem = (id: number, patch: GoalItemPatch) => call<GoalItem>('PATCH', `/goal-items/${id}`, patch);
export const deleteGoalItem = (id: number) => call<void>('DELETE', `/goal-items/${id}`);

export const getDashboard = (range: { from: DateStr; to: DateStr }) => call<DashboardData>('GET', `/dashboard?${searchParams(range)}`);

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
