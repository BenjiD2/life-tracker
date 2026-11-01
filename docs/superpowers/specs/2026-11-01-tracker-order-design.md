# Tracker and Subject Order — Design

**Date:** 2026-11-01
**Status:** Draft, awaiting approval. On approval the behaviour here is folded
into `2026-10-31-life-tracker-design.md` (the authority) in the same change as
the code.
**Builds on:** `2026-11-01-subjects-design.md` (branch `subjects`, not yet
merged). This work branches from it as `tracker-order`.

## 1. Why

With subjects, the user keeps a minutes tracker and a lessons tracker per
subject (for example "Chinese study" and "Chinese lessons"). Manage lists
each area's trackers in creation order, so trackers of one subject end up
apart, and there is no way to choose the order trackers or subjects appear
in anywhere in the app.

The user wants to:

- see Manage grouped by subject, the way Today already is,
- choose the order of trackers within a subject,
- choose the order of subjects, if that isn't hard (it isn't: see §3),
- have Today and the Dashboard follow the same order.

**Success:** the user can put "Chinese lessons" right after "Chinese study",
put C++ above Chinese, and see that order on Manage, Today and the Dashboard.

## 2. Goals, non-goals, anti-goals

**Goals**

- One saved order per area, used by Manage, Today and the Dashboard.
- Manage grouped by subject, with ↑ / ↓ to move a tracker within its group
  and to move a whole subject past its neighbour.

**Non-goals (this change)**

- Reordering areas. Areas keep their current order.
- Drag-and-drop.
- Ordering the archived list, books, or goals.
- Moving the no-subject group. It stays first, as it is now.

**Anti-goals (would make this a failure even if it works)**

- Subjects become something you have to create or manage separately. They
  stay a tag typed on the tracker (subjects spec §2).
- Existing trackers jump around the first time the app loads after the
  change.
- Reordering is fiddly: more than one click per step, or a save button.

## 3. Data model

One new column on `trackers` (one Drizzle migration; run `npm run backup`
before it lands on the live DB):

```
trackers.position   integer, not null
```

- The migration sets `position = id` for existing trackers, so the first load
  shows today's order (creation order).
- A new tracker gets `position` = the highest position + 1, so it lands at
  the end of its group.
- **Order of trackers** anywhere = ascending `position`.
- **Order of groups within an area** (`groupBySubject` in `shared/subjects.ts`):
  the no-subject group first, then subjects by the lowest `position` among
  their trackers (archived included), instead of alphabetically. Subject
  grouping and labels are unchanged (case- and space-insensitive; label from
  the lowest-id tracker). Because archived trackers count, group order is
  worked out from the full tracker list even where a page shows only active
  or visible trackers, so Manage, Today and the Dashboard always agree.
  *(Builder-check call.)*
- **Changing a tracker's subject** keeps its `position`: it shows up in the
  new subject's group wherever its position falls. If it is the first
  tracker of that subject, the subject's place follows from its position.
- **Moving a tracker to another area** keeps its `position` the same way.

No separate table or list of subjects: a subject's place is where its
trackers are.

## 4. Moves

Both moves only consider **active (non-archived) trackers in the same area**
when finding a neighbour. Archived trackers keep their positions and move
along with their group when a whole subject moves.

- **Move tracker up/down:** swap places with the nearest active tracker
  above/below it in the same group (same area, same subject key, or both
  without a subject). At the top or bottom of its group it doesn't move (and
  the button is disabled).
- **Move subject up/down:** swap the whole subject block with the nearest
  subject above/below it in the same area that has at least one active
  tracker. Every tracker of both subjects (archived included) moves, and each
  subject keeps its internal order. The no-subject group never takes part,
  and a subject can't move above it. At either end it doesn't move.
  A subject's positions may be interleaved with other groups' (after a
  subject edit or an area move), so the swap rebuilds that area's order with
  the two blocks exchanged and hands the area's existing position numbers out
  in the new order. Other areas are untouched. *(Builder-check call.)*

These are pure functions in `shared/subjects.ts`, written test-first. Each
takes the full tracker list and returns the new order of all tracker ids
(or the same order when the move isn't possible).

## 5. API

- `PUT /api/trackers/order` with body `{ ids: number[] }`: the complete list
  of tracker ids (archived included) in their new order. The server checks
  that it is exactly the set of existing tracker ids, no duplicates, none
  missing, and returns **400** otherwise. It then sets each tracker's
  `position` to its index, in one transaction, and returns the trackers in
  the new order.
- `GET /api/trackers` returns trackers in `position` order.
- `Tracker` in `shared/types.ts` gains `position: number`. `position` is not
  accepted by `POST` or `PATCH /api/trackers` (it is set by the server or by
  the order endpoint).
- The dashboard payload is unchanged; the web already orders by the tracker
  list.

## 6. Screens

### Manage (Trackers section)

- Each area's active trackers are shown with `groupBySubject`: the no-subject
  trackers first without a heading, then a small heading per subject, in the
  saved order.
- Each tracker row gets ↑ / ↓ buttons (move within its group). Each subject
  heading gets ↑ / ↓ (move the subject). A button that can't move anything
  is disabled. One click is one step; the order saves straight away.
- The archived list is unchanged.

### Today

- Unchanged apart from order: groups and trackers follow the saved order, so
  subjects are no longer alphabetical.

### Dashboard

- Subject sections and the series within each chart follow the saved order.
  Colours are assigned by tracker order (subjects spec §5), so **reordering
  changes a tracker's colour**. This is accepted.
- The "Estimated time by subject" stacks follow subject order, with the
  "No subject" stack still last: it is a remainder, so it sits on top of the
  stack, as now. *(Builder-check call.)*

## 7. Testing

Test-first, per CLAUDE.md.

- `shared/subjects.ts`: group order by position (no-subject first, then
  subjects by their lowest position); move tracker up/down within its group,
  skipping archived neighbours and trackers in other groups or areas; no-op
  at the ends; move subject up/down swapping whole blocks (archived trackers
  move with their block, internal order kept); subject can't pass the
  no-subject group; no-op at the ends.
- Routes: new tracker gets the last position; `GET /api/trackers` is in
  position order; `PUT /api/trackers/order` happy path, and 400 for a missing
  id, an unknown id, and a duplicate; `position` in a POST/PATCH body is
  refused (400, as `.strict()` already does for unknown keys on PATCH).
- Migration: existing trackers get `position = id`.
- UI verified by running a scratch copy on spare ports against a scratch DB
  (CLAUDE.md).

## 8. Left to the builder

- Button look and placement on rows and headings.
- Whether the web sends the order right after a click or waits briefly (it
  must not need a save button).
- Exact names of the move functions.
