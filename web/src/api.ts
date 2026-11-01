import { hc, type ClientResponse } from 'hono/client';
import type { createApp } from '../../server/app';
import type {
  AreaInput, AreaPatch, BookInput, BookPatch, EntryInput, GoalInput, GoalItemInput, GoalItemPatch, GoalPatch,
  ReadingLogInput, TrackerInput, TrackerPatch,
} from '../../shared/schemas';
import type { DateStr } from '../../shared/types';

// Typed by the server's own routes: the import is type-only, so no server code reaches the bundle.
const { api } = hc<ReturnType<typeof createApp>>('/');

/** The success body of a route's responses: unwraps each member of the union, then drops the `{ error }` ones. */
type Success<R> = R extends ClientResponse<infer T, number, string> ? (T extends { error: string } ? never : T) : never;

/** Awaits a request; every failure becomes an Error carrying the API's `{ error }` message. */
async function body<R extends Response>(pending: Promise<R>): Promise<Success<R>> {
  const res = await pending;
  if (res.status === 204) return undefined as Success<R>;
  const data = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) throw new Error(data.error ?? res.statusText);
  return data;
}

const param = (id: number) => ({ id: String(id) });

export const getAreas = () => body(api.areas.$get());
export const createArea = (json: AreaInput) => body(api.areas.$post({ json }));
export const updateArea = (id: number, json: AreaPatch) => body(api.areas[':id'].$patch({ param: param(id), json }));
export const deleteArea = (id: number) => body(api.areas[':id'].$delete({ param: param(id) }));

export const getTrackers = () => body(api.trackers.$get());
export const createTracker = (json: TrackerInput) => body(api.trackers.$post({ json }));
export const updateTracker = (id: number, json: TrackerPatch) => body(api.trackers[':id'].$patch({ param: param(id), json }));
export const reorderTrackers = (ids: number[]) => body(api.trackers.order.$put({ json: { ids } }));

export const getEntries = (date: DateStr) => body(api.entries.$get({ query: { date } }));
export const putEntry = (json: EntryInput) => body(api.entries.$put({ json }));
export const deleteEntry = (trackerId: number, date: DateStr) => body(api.entries.$delete({ query: { trackerId: String(trackerId), date } }));

export const getBooks = () => body(api.books.$get());
export const createBook = (json: BookInput) => body(api.books.$post({ json }));
export const updateBook = (id: number, json: BookPatch) => body(api.books[':id'].$patch({ param: param(id), json }));
export const putReadingLog = (json: ReadingLogInput) => body(api['reading-log'].$put({ json }));

export const getGoals = () => body(api.goals.$get());
export const createGoal = (json: GoalInput) => body(api.goals.$post({ json }));
export const updateGoal = (id: number, json: GoalPatch) => body(api.goals[':id'].$patch({ param: param(id), json }));
export const deleteGoal = (id: number) => body(api.goals[':id'].$delete({ param: param(id) }));
export const createGoalItem = (goalId: number, json: GoalItemInput) => body(api.goals[':id'].items.$post({ param: param(goalId), json }));
export const updateGoalItem = (id: number, json: GoalItemPatch) => body(api['goal-items'][':id'].$patch({ param: param(id), json }));
export const deleteGoalItem = (id: number) => body(api['goal-items'][':id'].$delete({ param: param(id) }));

export const getDashboard = (query: { from: DateStr; to: DateStr }) => body(api.dashboard.$get({ query }));

export const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));
