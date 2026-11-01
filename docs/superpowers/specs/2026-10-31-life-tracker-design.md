# Life Tracker — Design Spec

**Date:** 2026-10-31
**Status:** v1 implemented 2026-10-31. This spec is kept current: change it when behaviour changes.

## 1. Purpose

A personal, single-user web app for logging and visualizing progress across
several areas of life: **fitness, reading, habits, mood, and learning**
(computer science and Chinese). The point is to see progress at a glance:
streaks, heatmaps, goal progress bars, and trends.

### Success criteria

- Logging a full day takes about 30 seconds from one screen.
- Every area shows a meaningful progress visual on a dashboard.
- Adding a new thing to track (a new habit, a new sport) requires **no code or
  schema change**, only a form in the app.
- Costs nothing to run.

### Usage context

- Primarily used on a laptop in the browser. Phone access is nice-to-have and
  deferred.
- One user. No authentication, no social features.

## 2. Stack and hosting

| Concern | Choice |
|---|---|
| Front end | React + TypeScript, built with Vite |
| Charts | Recharts (heatmap may be a small custom component) |
| Server | Hono on Node.js |
| Database | SQLite (single file, `tracker.db`) |
| ORM / migrations | Drizzle (schema in TypeScript, generated SQL migrations committed to git) |
| Validation | Zod on every API request body |
| Tests | Vitest |
| Hosting | Runs locally on the laptop (`localhost`). Cost: $0 |

**Later, not in v1:** phone access through Tailscale (free private network
between the user's own devices) pointing at the laptop. If always-on access is
wanted, deploy the same code to Fly.io or Railway (~$0–5/month) and add
authentication at that time.

**Backups:** `npm run backup` writes a dated snapshot to `backups/`
(git-ignored) using SQLite's online backup, safe while the app runs. Run it
before any migration. `backups/` is on the same disk, so copy snapshots to
iCloud Drive or similar for off-machine safety. Restore: stop the server and
copy a snapshot over `tracker.db`.

## 3. Data model

### Tables

```
areas        id, name, color
trackers     id, area_id → areas, name, kind ('check'|'quantity'|'rating'),
             unit (nullable), archived (bool, default false)
entries      id, tracker_id → trackers, date ('YYYY-MM-DD'), value (number),
             note (nullable)
             UNIQUE (tracker_id, date)
books        id, title, author, total_pages, start_page (default 0),
             status ('reading'|'done'|'dropped'),
             topic (nullable), started (date, nullable), finished (date, nullable)
reading_log  id, book_id → books, date ('YYYY-MM-DD'), page_reached
             UNIQUE (book_id, date)
goals        id, title, area_id → areas, type ('consistency'|'completion'),
             created ('YYYY-MM-DD', set when the goal is created),
             -- consistency fields
             scope_tracker_id (nullable → trackers), period ('week'|'month'),
             target_days,
             -- completion fields
             source ('books'|'tracker'|'checklist'), target, deadline (nullable),
             source_tracker_id (nullable → trackers), book_topic (nullable)
goal_items   id, goal_id → goals, label, done_at (date, nullable)
```

Fields that belong to the other goal type are null. Zod validation enforces
that the right fields are present for each `type` and `source`.

### Meaning of `entries.value`

The tracker's `kind` decides how `value` is read, and which input the UI shows:

| `kind` | `value` | UI input | Typical visuals |
|---|---|---|---|
| `check` | always `1` | checkbox | streaks, heatmap |
| `quantity` | amount in the tracker's `unit` | number field | totals per week/month, intensity heatmap |
| `rating` | integer 1–5 | five buttons | trend line, average |

An area can hold any mix of tracker kinds.

### Starting configuration (seed data)

| Area | Trackers |
|---|---|
| Fitness | Tennis (quantity, minutes), Pickleball (quantity, minutes), Lifting (quantity, minutes) |
| Habits | Created by the user in the Manage screen |
| Mood | Mood (rating) |
| Learning | Chinese study (quantity, minutes), CS study (quantity, minutes) |
| Reading | Uses the `books` and `reading_log` tables |

### Derived values (calculated when needed, never stored)

- **Area active day:** a date counts as active for an area if any of the area's
  trackers has an entry on that date with a non-zero value (logging `0` minutes
  is not activity). No separate "worked out" checkbox. Books aren't linked to
  an area, so the area named "Reading" (case-insensitive) also counts every
  date with pages read > 0.
- **Pages read on a date:** `page_reached` minus the previous `page_reached`
  for the same book (for a book's first log, minus its `start_page`: the page
  already reached before tracking began, so prior progress isn't counted as
  reading on the first day).
- **Goal progress:** calculated from `entries`, `books`, `reading_log`, and
  `goal_items`. Goals store only their rules.
- **Streaks:** see section 4.

## 4. Goals

### Consistency goals ("keep it up")

Example: *Fitness: 12 active days per month.*

- **Scope:** the whole area (any tracker in the area counts), or a single
  tracker if `scope_tracker_id` is set.
- **Period:** `week` (Monday–Sunday) or `month` (calendar month).
- **Current progress:** active days in the current period / `target_days`.
- **Period streak:** the number of consecutive *completed* periods, counting
  back from the most recent one, in which the target was met. The current,
  unfinished period adds to the streak if the target is already met, but
  doesn't break the streak if it isn't met yet.
- **Visuals:** calendar heatmap, progress ring for the current period, period
  streak count.

### Completion goals ("get it done")

Example: *Read 20 books in 2026.*

- **Source** decides the current value:
  - `books`: number of books with `status = 'done'`, filtered by `book_topic`
    when set (case-insensitive, ignoring surrounding spaces), counting only
    books finished on or after the goal's creation date and on or before the
    deadline (if any).
  - `tracker`: sum of `value` across all entries of `source_tracker_id`.
  - `checklist`: number of `goal_items` with `done_at` set. The target equals
    the number of items.
- **Pace:** if `deadline` is set, the expected value today is
  `target × (days elapsed / total days)`, from the goal's creation date to the
  deadline. The UI shows ahead or behind by the difference.
- **Visuals:** progress bar and pace line.

## 5. Screens

1. **Today (home page).** Every non-archived tracker, grouped by area, shown as
   its kind's input. Already-logged trackers show their value. A date picker
   (◀ ▶) allows logging past days. A reading row allows updating the page for
   any book with status `reading`. A strip at the top shows current goal
   progress.
2. **Dashboard.** A time-range filter above the cards: presets (last 4 weeks,
   last 12 weeks (default), last 6 months, this year, last 12 months) and a
   custom from–to range, kept in the URL. One card per area: heatmap of active
   days, goal progress bars, ring, and pace line, tracker totals, mood trend
   line, pages read. Totals are per week for ranges up to ~26 weeks, per month
   beyond. Heatmaps, totals, mood, and pages follow the range; goals always
   show current progress.
3. **Books.** Books being read now (with progress bars and a page-update
   input), a finished shelf, a dropped list, adding books (optionally with the
   page already reached), editing a book's details, and changing status.
4. **Manage.** Create, edit, and archive areas, trackers, goals, and checklist
   items.

## 6. Code organization

```
life-tracker/
├── shared/                  used by server and browser
│   ├── dates.ts             date strings, week/month periods
│   ├── types.ts             row and API types
│   └── schemas.ts           Zod input schemas
├── server/
│   ├── db/                  Drizzle schema, client, seed, migrations (committed)
│   ├── stats/               pure functions, no database or HTTP access
│   ├── routes/              thin handlers: validate → query → stats → JSON
│   ├── scripts/backup.ts    npm run backup
│   ├── app.ts               createApp(db, today)
│   └── index.ts
└── web/src/
    ├── api.ts               typed fetch wrappers
    ├── pages/               Today, Dashboard, Books, Manage
    └── components/          Heatmap, ProgressRing, PaceBar, TrendChart, …
```

`stats/` functions take plain arrays plus a `today` date string and return
plain values, so they can be tested without a database.

## 7. Rules and error handling

- **Dates** are `'YYYY-MM-DD'` strings in the user's local time zone, used
  everywhere. JavaScript `Date` objects are never used to store or compare
  entry dates.
- **One entry per tracker per day:** saving again overwrites the existing
  entry. Multiple sessions in a day are logged as the combined total.
  `reading_log` follows the same rule per book per day.
- **Validation (Zod), with errors shown next to the input:**
  - `rating` value must be an integer 1–5.
  - `check` value must be 1. Unchecking deletes the entry.
  - `quantity` value must be ≥ 0.
  - `page_reached` must be between 0 and the book's `total_pages`.
  - Goal fields must match the goal's `type` and `source`.
  - A book's `start_page` is between 0 and `total_pages`, and `total_pages`
    can't drop below `start_page` or any logged `page_reached`.
- **Logging the last page:** setting `page_reached = total_pages` asks the user
  whether to mark the book `done`, with `finished` set to the date of that log
  (not today, when logging a past date).
- **Archiving** a tracker hides it from Today and Manage's active list.
  Its entries remain and still count in history and goals. Trackers are never
  deleted, and a tracker's `kind` can't change after creation.
- **Refused with 409:** deleting an area that still has trackers (archived
  included; the message names them) or goals; moving a tracker to another area
  while a goal is scoped to it.

## 8. Testing

- **Vitest unit tests on `stats/`** using small hand-made datasets. Required
  cases:
  - Week and month boundaries, including a Sunday-to-Monday rollover and
    month ends of 28, 30, and 31 days.
  - A period streak with the current period unfinished, met, and not yet met.
  - Area active days with multiple trackers logged on the same day (counted
    once).
  - Pages read with gaps between logs, and a book's first log.
  - A completion goal with no data, one past its deadline, and a pace
    calculation on the deadline day.
- **Route tests:** one happy-path and one validation-failure test per write
  endpoint, against a temporary SQLite database.
- UI checked by running the app.

## 9. Out of scope for v1

- AI reviews of activity (possible v2: a weekly review using the Claude API,
  with an `ai_reviews` table and the key kept on the server).
- A "show on Today" setting per tracker.
- Detailed workout tracking (exercises, sets, reps).
- Phone access and deployment.
- Authentication.
- Data export (synced folder backups are enough for v1).
