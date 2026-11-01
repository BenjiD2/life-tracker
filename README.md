# Life Tracker

A personal, local web app for logging fitness, reading, habits, mood, and learning, with streaks, goals, heatmaps, and trends.

## Run it

```
npm install
npm run dev        # API on :3000, app on http://localhost:5173
```

Run commands from this folder: the server opens `tracker.db` relative to where it starts.

## Pages

- **Today:** log every tracker for a day (◀ ▶ for past days) and update pages for books you're reading.
- **Dashboard:** heatmaps, goal rings and pace bars, totals, mood, and pages read, filtered by time range.
- **Books:** reading list, finished shelf, add and edit books. If you're partway through a book when you add it, fill in *Already at page* so earlier reading isn't counted as one day's reading.
- **Manage:** areas, trackers (check / quantity / rating, with an optional subject and ≈ minutes each), goals, and checklist items.

## Your data

Everything lives in `tracker.db`, a SQLite file in this folder. It isn't in git and isn't uploaded anywhere.

```
npm run backup                                  # → backups/tracker-YYYY-MM-DD-HHMM.db
cp backups/<snapshot>.db tracker.db             # restore (stop npm run dev first)
sqlite3 tracker.db "select * from entries order by date desc limit 10;"   # peek
```

`backups/` sits on the same disk, so copy a snapshot to iCloud Drive now and then. Back up before pulling changes that add a migration in `server/db/migrations/`.

## Develop

```
npm test           # Vitest: stats and API routes
npm run typecheck
```

Behaviour is specified in `docs/superpowers/specs/2026-10-31-life-tracker-design.md`.
