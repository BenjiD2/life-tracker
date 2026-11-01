# Tracker and Subject Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** A saved `position` on trackers, with ↑ / ↓ in Manage to reorder trackers within a subject and whole subjects within an area, followed by Manage, Today and the Dashboard.

**Architecture:** One integer column. Pure order functions in `shared/subjects.ts` (group order, move tracker, move subject) return a full id order; the web sends it to one `PUT /api/trackers/order` endpoint that renumbers positions in a transaction. Pages pass the area's full tracker list to `groupBySubject` so group order is the same everywhere.

**Tech Stack:** Hono, Drizzle/SQLite (drizzle-kit migrations), Zod, React 19, Vitest.

**Spec:** `docs/superpowers/specs/2026-11-01-tracker-order-design.md` (and CLAUDE.md for repo rules).

## Global Constraints

- Branch `tracker-order` (from `subjects`). Commit per task; end commit messages with `Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>`. Do not push or merge.
- `tracker.db` is live. Run `npm run backup` before generating the migration. Never write test data to it. Verify UI only on ports 3101/5199 against a scratch DB, after checking `lsof -nP -iTCP:3000 -iTCP:5173 -sTCP:LISTEN`.
- Order = ascending `position`, ties broken by `id`.
- Group order within an area: no-subject group first, then subjects by the lowest `position` among their trackers, **archived included**. Labels unchanged (lowest-id tracker's spelling).
- Moves only find neighbours among **active trackers in the same area**. Archived trackers move with their subject block.
- The no-subject group never moves, and no subject moves above it.
- "Estimated time by subject" keeps "No subject" last.
- Errors are `{ error }` JSON with 400 / 404. Run `npm test` and `npm run typecheck` at the end of every task.

## Review Focus

1. **Fresh database** (seed, or a scratch DB): seeded trackers must get distinct positions in seed order, not all 0. Pinned in Task 2 (`client.test.ts`).
2. **The user's live DB after the migration:** existing trackers get `position = id`, so nothing moves on first load. Pinned in Task 2 (migration test on a pre-migration file DB).
3. **A subject whose trackers are interleaved with another group's positions** (after a subject edit or an area move): moving it must still swap only the two subjects, and leave other areas' positions alone. Pinned in Task 1 (`moveSubject` interleaved test).
4. **Moving the last active tracker past an archived one:** it's a no-op (button disabled), not a swap with the hidden archived tracker. Pinned in Task 1.
5. **Two quick clicks** before the first save returns: each click computes from the latest saved list, so the second click works from the refreshed order and nothing is lost. Handled in Task 3 by disabling the move buttons while a save is in flight; checked during manual verification.

---

### Task 1: Order functions

**Files:**
- Modify: `shared/subjects.ts`, `shared/subjects.test.ts`

**Interfaces:**
- Produces:
  - `groupBySubject<T extends { id: number; subject: string | null; position: number }>(trackers: T[], all: { id: number; subject: string | null; position: number }[] = trackers): SubjectGroup<T>[]`: groups `trackers`; within a group, trackers sorted by position then id; the no-subject group first; subjects ordered by the lowest position among the trackers in `all` with that subject key (callers pass the area's full list, archived included).
  - `type Direction = 'up' | 'down'`
  - `type OrderItem = { id: number; areaId: number; subject: string | null; archived: boolean; position: number }`
  - `moveTracker(trackers: OrderItem[], id: number, dir: Direction): number[]`: all tracker ids in the new order.
  - `moveSubject(trackers: OrderItem[], areaId: number, key: string, dir: Direction): number[]`: all tracker ids in the new order. `key` is a `subjectKey` value.
  - Both return the current order unchanged when the move isn't possible.
  - `canMoveTracker(trackers: OrderItem[], id: number, dir: Direction): boolean` and `canMoveSubject(trackers: OrderItem[], areaId: number, key: string, dir: Direction): boolean`, for disabling buttons.

- [ ] **Step 1: Update the existing tests for the new signature.** Add `position` to the `groupBySubject` and `minutesBySubject` fixtures. Rewrite the grouping test with positions that differ from ids: `[{id:3,subject:'chinese',position:5},{id:1,subject:' Chinese ',position:2},{id:2,subject:null,position:9},{id:4,subject:'C++',position:3},{id:5,subject:'',position:1}]` → `[{key:null,label:null,ids:[5,2]},{key:'chinese',label:'Chinese',ids:[1,3]},{key:'c++',label:'C++',ids:[4]}]` (Chinese's lowest position 2 beats C++'s 3; label still from id 1).
- [ ] **Step 2: Add a test** `groupBySubject orders subjects from the full list`: trackers `[{id:1,subject:'A',position:5},{id:2,subject:'B',position:3}]`, `all` additionally containing `{id:3,subject:'a',position:1}` (archived, absent from `trackers`) → keys `['a','b']`.
- [ ] **Step 3: Add `moveTracker` tests.** Fixture, all in area 1 unless noted: `1 null p1`, `2 'C' p2`, `3 'C' p3 (archived)`, `4 'C' p4`, `5 'D' p5`, `6 'C' p6 area 2`. Expect:
  - `moveTracker(t, 4, 'up')` → order `[1, 4, 3, 2, 5, 6]` (swaps with 2, skipping archived 3; positions 2 and 4 exchanged).
  - `moveTracker(t, 2, 'up')` → unchanged (top of group C); `canMoveTracker(t, 2, 'up')` false.
  - `moveTracker(t, 4, 'down')` → unchanged (only archived 3 or other groups/areas below); `canMoveTracker(t, 4, 'down')` false. (Review Focus 4)
  - `moveTracker(t, 1, 'down')` → unchanged (no-subject group has one tracker).
- [ ] **Step 4: Add `moveSubject` tests.** Fixture, area 1: `1 null p1`, `2 'A' p2`, `3 'B' p3`, `4 'A' p4 (archived)`, `5 'B' p5`, `6 'C' p6 (archived only)`; area 2: `7 'A' p7`. Expect:
  - `moveSubject(t, 1, 'b', 'up')` → `[1, 3, 5, 2, 4, 6, 7]` (B block before A block, internal order kept, archived 4 travels with A, area 2 untouched). (Review Focus 3: A and B interleave.)
  - `moveSubject(t, 1, 'a', 'up')` → unchanged (can't pass the no-subject group); `canMoveSubject` false.
  - `moveSubject(t, 1, 'b', 'down')` → unchanged (C has no active tracker, so B is last); `canMoveSubject` false.
- [ ] **Step 5: Run** `npx vitest run shared/subjects.test.ts`. Expected: FAIL.
- [ ] **Step 6: Implement** in `shared/subjects.ts`. `moveTracker` swaps positions with the nearest active same-area, same-key tracker in the direction, then returns all ids sorted by (position, id). `moveSubject`:

  ```
  area = trackers in areaId, sorted by (position, id); slots = their positions in that order
  groups = groupBySubject(area)                     // null group first, then subjects
  i = index of key among subject groups; j = nearest index in dir whose group has an active tracker
  if none: return current order
  swap groups i and j; seq = concat of all groups' trackers (null group first)
  give seq[k] the position slots[k]; other areas keep theirs
  return all ids sorted by (new position, id)
  ```
- [ ] **Step 7: Run** `npx vitest run shared/subjects.test.ts && npm run typecheck`. Expected: PASS. Typecheck will fail where `Tracker` lacks `position`; add `position: number` to `Tracker` in `shared/types.ts` now (Task 2 adds the column).
- [ ] **Step 8: Commit** `feat: tracker and subject order functions`.

### Task 2: Position column, order endpoint

**Files:**
- Modify: `server/db/schema.ts`, `server/db/seed.ts`, `shared/schemas.ts`, `server/routes/catalog.ts`, `web/src/api.ts`
- Create: `server/db/migrations/0003_*.sql` (generated, then edited) plus meta
- Test: `server/routes/catalog.test.ts`, `server/db/client.test.ts`

**Interfaces:**
- Consumes: `Tracker.position` (Task 1).
- Produces: `trackers.position` column (`integer('position').notNull().default(0)`); `trackerOrder = z.object({ ids: z.array(id) })` and `TrackerOrder` in `shared/schemas.ts`; `PUT /api/trackers/order` returning `Tracker[]` in order; `api.reorderTrackers(ids: number[]): Promise<Tracker[]>`.

- [ ] **Step 1: Write failing route tests** in `catalog.test.ts`, `describe('tracker order')`:
  - A POSTed tracker's `position` is greater than every seeded tracker's.
  - `GET /api/trackers` is in position order: after `PUT /order` with the seeded ids reversed, GET returns them reversed and `position`s are `0..n-1`.
  - `PUT /order` with one id missing, with an unknown id `999` added, and with a duplicate → 400 with a string `error`, and GET order unchanged.
  - POST with `position: 5` → 400; PATCH with `position: 5` → 400.
- [ ] **Step 2: Write failing DB tests** in `client.test.ts`:
  - Seeded trackers have distinct positions in seed order (Tennis < Pickleball < … < CS study). (Review Focus 1)
  - Migration: copy `server/db/migrations` into a temp dir, trim `meta/_journal.json` to the first 3 entries, `migrate` a temp file DB with that folder, insert three trackers with ids 1, 2, 3 via raw SQL, then `createDb(thatFile)` and expect `position` equal to `id` for each. (Review Focus 2)
- [ ] **Step 3: Run** `npx vitest run server/routes/catalog.test.ts server/db/client.test.ts`. Expected: FAIL.
- [ ] **Step 4: Implement.**
  - Schema column as in Interfaces. `trackerInput` gets `.strict()` (so `position` is refused on POST; the web sends only known keys).
  - Seed: give each inserted tracker `position` = a running counter in seed order.
  - POST `/trackers`: `position` = (max position over all trackers) + 1, or 0 when none.
  - GET `/trackers`: `orderBy(trackers.position, trackers.id)`.
  - PUT `/trackers/order`: validate with `trackerOrder`; 400 `'Order must list every tracker exactly once'` unless the ids are exactly the set of tracker ids with no duplicates; then in one `db.transaction` set `position = index`; return GET's result.
  - `web/src/api.ts`: `reorderTrackers`.
- [ ] **Step 5: Run** `npm run backup`, then `npm run db:generate`. Expected: a new `0003_*.sql` with one `ALTER TABLE trackers ADD position integer DEFAULT 0 NOT NULL`. Append `--> statement-breakpoint` and `UPDATE trackers SET position = id;` to it.
- [ ] **Step 6: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 7: Commit** `feat: saved tracker order`.

### Task 3: Manage, Today and Dashboard follow the order

**Files:**
- Modify: `web/src/pages/Manage.tsx` (`TrackersSection`), `web/src/pages/Today.tsx`, `web/src/pages/Dashboard.tsx` (`AreaCard`), `web/src/styles.css`

**Interfaces:**
- Consumes: `groupBySubject`, `moveTracker`, `moveSubject`, `canMoveTracker`, `canMoveSubject` (Task 1); `api.reorderTrackers` (Task 2).

- [ ] **Step 1: Manage.** For each area, render `groupBySubject(activeOwn, allOwn)` where `allOwn` is the area's trackers including archived. No-subject rows first with no heading; each subject gets a heading row with its label and ↑ / ↓. Each tracker row gets ↑ / ↓ before the Archive button. Clicks call `attempt(() => api.reorderTrackers(moveTracker(trackers, t.id, dir)))` (or `moveSubject(trackers, areaId, g.key, dir)`), using the full `trackers` list. Buttons are disabled when `canMove…` is false, or while a reorder is saving (Review Focus 5). Buttons have `aria-label`s like `Move Chinese lessons up` and `Move subject Chinese up`.
- [ ] **Step 2: Today.** `groupBySubject(own, trackers.filter((t) => t.areaId === area.id))`.
- [ ] **Step 3: Dashboard.** In `AreaCard`, `groupBySubject(visibleTrackers(trackers, data), trackers)` (`trackers` is already the area's full list). No change to `AreaCharts.tsx`: series follow group order, and `minutesBySubject` keeps "No subject" last.
- [ ] **Step 4: Style** the ↑ / ↓ buttons small and quiet (reuse `button.link` or a compact `.move` class), and the Manage subject heading like `.subject-head`.
- [ ] **Step 5: Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 6: Commit** `feat: reorder trackers and subjects in Manage`.

### Task 4: Fold into the main spec, verify in the app

**Files:**
- Modify: `docs/superpowers/specs/2026-10-31-life-tracker-design.md` (§3 tables and order, §5 Manage/Today/Dashboard, §7 validation), `docs/superpowers/specs/2026-11-01-tracker-order-design.md` (Status: implemented, folded into the main spec)

- [ ] **Step 1: Update the docs** so the main spec describes the shipped behaviour.
- [ ] **Step 2: Start a scratch copy** from a copy of the latest backup (so the migration runs on real-shaped data): `cp backups/<latest>.db <scratchpad>/order.db`, check ports, then `PORT=3101 TRACKER_DB=<scratchpad>/order.db npx tsx server/index.ts` and `API_PORT=3101 npx vite --port 5199`. Confirm via `GET :3101/api/trackers` that the order matches the old id order.
- [ ] **Step 3: Set up and check in the browser on :5199:** add subjects Chinese and C++ with two trackers each, and one archived tracker in Chinese.
  - In Manage, move "Chinese lessons" up past "Chinese study"; move C++ above Chinese; the end buttons are disabled.
  - Today and the Dashboard show the same group and tracker order.
  - Two fast clicks on ↑ don't lose a move or error.
- [ ] **Step 4: Stop the scratch servers. Run** `npm test && npm run typecheck`. Expected: PASS.
- [ ] **Step 5: Commit** `docs: fold tracker order into the design spec`.
