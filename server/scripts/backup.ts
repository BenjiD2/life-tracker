import Database from 'better-sqlite3';
import { existsSync, mkdirSync, statSync } from 'node:fs';
import { basename, join } from 'node:path';

// Usage: npm run backup  →  backups/tracker-YYYY-MM-DD-HHMM.db
// Uses SQLite's online backup, so it's safe while the app is running (a plain cp could catch a half-written file).

const source = process.env.TRACKER_DB ?? 'tracker.db';
if (!existsSync(source)) {
  console.error(`No database at ${source}. Run this from the life-tracker folder.`);
  process.exit(1);
}

const now = new Date();
const pad = (n: number) => String(n).padStart(2, '0');
const stamp = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}-${pad(now.getHours())}${pad(now.getMinutes())}`;
mkdirSync('backups', { recursive: true });
const dest = join('backups', `${basename(source, '.db')}-${stamp}.db`);

const db = new Database(source, { readonly: true, fileMustExist: true });
await db.backup(dest);
db.close();
console.log(`Backed up ${source} → ${dest} (${(statSync(dest).size / 1024).toFixed(0)} KB)`);
