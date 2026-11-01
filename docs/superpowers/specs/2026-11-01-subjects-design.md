# Subjects and Estimated Time — Design

**Date:** 2026-11-01
**Status:** Implemented 2026-11-01 and folded into
`2026-10-31-life-tracker-design.md`, which is now the authority. Kept as the
record of why.

## 1. Why

The user studies Chinese and C++ in two ways at once: **lesson-based** work
(lessons in an app, course modules) and **time-based** work (flashcards,
reading, free practice). Today each area gets one "Weekly totals" bar chart
that stacks every quantity tracker in it. Lessons and minutes on the same
stacked axis mean nothing, and there is no per-subject view: Chinese and CS
both sit inside *Learning*.

The user wants to:

- log lessons completed and practice time as separate things,
- see, per subject, a graph of lessons, a graph of practice time, and a
  combined graph that estimates total time from a configurable
  minutes-per-lesson figure,
- keep *Learning* as one area, with the subjects shown inside its card.

**Success:** for any subject in any week, the user can see how many lessons
they did, how much practice time they put in, and roughly how many hours that
adds up to, and can compare subjects against each other.

## 2. Goals, non-goals, anti-goals

**Goals**

- A **subject** label on trackers, used to group them inside an area.
- A configurable **minutes per unit** on quantity trackers, so non-minute
  units (lessons, modules, chapters) can be converted into estimated time.
- Dashboard: per-subject sections with one graph per unit and an estimated
  total time graph; an area-level estimated time graph stacked by subject.
- Fixes the mixed-unit stacking for every area, not just Learning.

**Non-goals (this change)**

- Subject-scoped goals (for example "10 Chinese lessons a week"). Goals keep
  scoping to an area or a single tracker. This could come later.
- Multiple sessions per day per tracker. The existing one-entry-per-day rule
  stands.
- Changing or migrating existing entry values.

**Anti-goals (would make this a failure even if it works)**

- Adding a subject requires code, a schema change, or a separate setup screen.
  It must be a tag typed on the tracker (spec §1: "no code or schema change to
  track a new thing").
- Logging gets slower or more complicated. Today stays one number per tracker
  per day.
- Lessons and minutes ever share a raw axis again.
- An estimated figure is shown in a way that reads as measured.

## 3. Data model

Two nullable columns on `trackers` (one Drizzle migration; run
`npm run backup` before it lands on the live DB):

```
trackers.subject           text, nullable   -- e.g. 'Chinese', 'C++'
trackers.minutes_per_unit  real, nullable   -- e.g. 40 for 'lessons'
```

- **Subject** is a free-text tag, trimmed. Grouping is case-insensitive and
  ignores surrounding spaces (same rule as `books.topic` for goals). The
  section heading uses the spelling of the subject's first tracker by id.
  `null` or empty means no subject.
- A subject belongs to its area: the same tag in two areas gives two separate
  sections. Subjects work in any area, not only Learning.
- **Minutes per unit** applies only to `quantity` trackers. It must be a
  positive number when set. It is how many minutes one unit of the tracker is
  worth.
- A tracker's **time in minutes** for an entry is:
  - `value` if its unit is a minute unit (`minutes`, `minute`, `min`, `mins`,
    case-insensitive, trimmed) and `minutes_per_unit` is null,
  - `value × minutes_per_unit` if `minutes_per_unit` is set (this also lets an
    `hours` tracker use 60),
  - not counted in estimated time otherwise.
- Estimated time is derived, never stored. Changing `minutes_per_unit`
  re-estimates all of history.

## 4. API and validation

- `trackerInput` and `trackerPatch` (`shared/schemas.ts`) gain
  `subject: string | null` (trimmed; empty becomes null) and
  `minutesPerUnit: number | null` (positive, finite).
- Setting `minutesPerUnit` on a non-quantity tracker returns **400**.
- `Tracker` in `shared/types.ts` gains `subject` and `minutesPerUnit`.
- The dashboard gains estimated time per tracker per bucket, computed by a
  pure function in `server/stats/` (per CLAUDE.md conventions), for example
  `trackerMinutes: { trackerId, periodStart, minutes }[]`, zero-filled like
  `trackerTotals`. Only trackers that count toward time appear in it. Subject
  grouping and per-subject sums can happen in the web from that plus the
  tracker list.

## 5. Screens

### Manage

- Each tracker row gets a **Subject** field: inline text, with a datalist of
  subjects already used in that tracker's area so tags stay consistent.
- Quantity tracker rows get a **≈ [ ] min each** field. It shows for any
  quantity tracker whose unit is not a minute unit, and also for any tracker
  that already has a value set (so a tracker renamed from `lessons` to
  `minutes` still shows its multiplier and it can be cleared). It is labelled
  so it reads as an estimate. Empty means the tracker is left out of estimated
  time unless its unit is a minute unit. *(Builder-check call.)*
- The add-tracker form gets the same two optional fields.

### Today

- Inside an area card, trackers with a subject are grouped under a small
  subject subheading. Ungrouped trackers come first, then subjects
  alphabetically. Inputs are unchanged.

### Dashboard (area card)

Top to bottom:

1. Heatmap and goals, unchanged. Any tracker in the area, subject or not,
   still counts toward active days.
2. **Estimated time by subject** (hours per bucket, stacked by subject).
   Time-counting trackers without a subject form a final **"No subject"**
   stack, so the area total is never quietly incomplete. Shown only when the
   area has at least one subject and the chart would have two or more stacks.
   *(Builder-check call.)*
3. **Ungrouped trackers:** today's charts, except quantity trackers are split
   into **one bar chart per unit** (stacked by tracker within a unit), plus an
   **Estimated total time** chart under the same rule as a subject section
   (below), so minutes per unit has a visible effect before anything is
   tagged. An area with no subjects, one unit, and no converted trackers looks
   as it does now, apart from the chart title, which now names the unit
   ("Minutes per week" instead of "Weekly totals (minutes)"). *(Builder-check call.)*
4. **One section per subject** (alphabetical), each with:
   - one bar chart per unit used by its trackers (for example "Lessons per
     week" and "Practice minutes per week"), stacked by tracker within a unit,
   - **Estimated total time** (hours per bucket), stacked by tracker, with the
     converted trackers visibly marked as estimated (lighter fill and
     "(est.)" in the legend). Every tracker with `minutes_per_unit` set
     counts as converted and is marked estimated, including an `hours`
     tracker at 60; there's no separate "exact conversion" rule.
     *(Builder-check call.)* Shown only when the subject has at least one
     converted tracker; otherwise it would repeat the minutes chart.
   - Rating trackers in a subject show their trend line inside the section.

Bucket size (week or month) and the range filter work as they do now.
Colours follow the existing fixed slot order (`--series-1..4`), with slots
assigned by tracker order within each chart and by subject order in the
by-subject chart.

## 6. Existing data

No data is migrated. After the change ships, the user tags their existing
"Chinese study" and "CS study" trackers with a subject in Manage, and adds new
trackers (for example "Chinese lessons" with unit `lessons` and ≈ 40 min each,
and "Flashcards" in minutes).

## 7. Testing

Test-first, per CLAUDE.md.

- `server/stats/`: time-in-minutes rules (minute units, conversion,
  conversion overriding a minute unit, unconvertible units excluded,
  zero-fill across buckets, range windowing).
- Routes: create and patch a tracker with subject and minutes per unit
  (happy path), 400 for `minutesPerUnit` on a check or rating tracker, 400 for
  zero or negative values, dashboard returns `trackerMinutes`.
- UI verified by running a scratch copy on spare ports against a scratch DB
  (CLAUDE.md), with seeded Chinese and C++ trackers across several weeks.

## 8. Left to the builder

- Exact component split on the dashboard (for example extracting a
  `QuantityCharts` component used by ungrouped and subject sections).
- Exact field placement and styling in Manage and Today.
- Hours formatting (one decimal place is fine).
