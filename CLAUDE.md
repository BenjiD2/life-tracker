# Life Tracker

Single-user local app: Hono + Drizzle/SQLite server, React/Vite web. `docs/superpowers/specs/2026-10-31-life-tracker-design.md` is the authority on behaviour: read it before changing behaviour, and update it in the same change when behaviour moves. The plan in `docs/superpowers/plans/` is a finished historical record.

## The user's data is live

`tracker.db` is the user's real personal data, and their `npm run dev` (`tsx watch` on :3000, Vite on :5173) is often running against it.

- **Edits restart their server.** `tsx watch` reloads on every server file change, and migrations run at startup, so `npm run db:generate` migrates their real DB on the next restart. Run `npm run backup` first.
- **Verify on scratch ports.** Check `lsof -nP -iTCP:3000 -iTCP:5173 -sTCP:LISTEN` before starting anything, then run your own copy beside theirs against a throwaway DB, and stop it when done:
  `PORT=3101 TRACKER_DB=<scratch>/test.db npx tsx server/index.ts` and `API_PORT=3101 npx vite --port 5199`.
- Test data goes in the scratch DB, never in `tracker.db`.

## Conventions

- **Dates are `DateStr` ('YYYY-MM-DD') strings**, compared as strings; `Date` appears only inside `shared/dates.ts`.
- **`server/stats/` is pure** (plain arrays + `today` in, plain values out) and holds all calculation; routes validate, query, call stats, and return JSON. Compute over full history, then window to a range: pages-read deltas need each book's earlier logs.
- **Test-first.** Route tests use `setup(today)` from `server/routes/testing.ts` (seeded in-memory DB, injected date). Run `npm test` and `npm run typecheck`; UI changes are verified by running the app.
- **Errors** are JSON `{ error }` with 400 / 404 / 409. Request bodies are Zod schemas in `shared/schemas.ts`, shared with the web.
- **The books area is the area named "Reading"** (`shared/books-area.ts`): books have no area link, so that's how reading days reach heatmaps and goals.
- **Workflow:** a branch per change, fast-forwarded into `main` once the user agrees. The user pushes.

## User

C++ trading developer, lighter on React and web: explain web concepts through systems analogies. Learning mode is on, but they prefer you implement rather than hand off TODOs.
