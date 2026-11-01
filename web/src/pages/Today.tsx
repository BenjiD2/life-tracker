import { useCallback, useEffect, useState } from 'react';
import { addDays, todayLocal } from '../../../shared/dates';
import type { Area, BookWithPage, DateStr, Entry, GoalWithProgress, Tracker } from '../../../shared/types';
import * as api from '../api';
import { GoalStrip } from '../components/GoalStrip';
import { TrackerInput } from '../components/TrackerInput';
import { formatDay } from '../format';

export function Today() {
  const [date, setDate] = useState<DateStr>(() => todayLocal());
  const [areas, setAreas] = useState<Area[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [books, setBooks] = useState<BookWithPage[]>([]);
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [loadError, setLoadError] = useState<string | null>(null);

  const refreshGoals = useCallback(() => api.getGoals().then(setGoals), []);
  const refreshBooks = useCallback(() => api.getBooks().then(setBooks), []);

  useEffect(() => {
    Promise.all([api.getAreas(), api.getTrackers()])
      .then(([a, t]) => { setAreas(a); setTrackers(t); })
      .catch((e) => setLoadError(api.errorMessage(e)));
    refreshGoals().catch(() => {});
    refreshBooks().catch(() => {});
  }, [refreshGoals, refreshBooks]);

  useEffect(() => {
    let live = true;
    setErrors({});
    api.getEntries(date).then((e) => live && setEntries(e)).catch((e) => setLoadError(api.errorMessage(e)));
    return () => { live = false; };
  }, [date]);

  /** Runs a write, records its error under `key`, and refreshes the goal strip on success. */
  async function attempt(key: string, write: () => Promise<void>) {
    try {
      await write();
      setErrors(({ [key]: _, ...rest }) => rest);
      refreshGoals().catch(() => {});
    } catch (e) {
      setErrors((prev) => ({ ...prev, [key]: api.errorMessage(e) }));
    }
  }

  const save = (t: Tracker, value: number, note: string | null) =>
    attempt(`t${t.id}`, async () => {
      const row = await api.putEntry({ trackerId: t.id, date, value, note });
      setEntries((prev) => [...prev.filter((e) => e.trackerId !== t.id), row]);
    });
  const clear = (t: Tracker) =>
    attempt(`t${t.id}`, async () => {
      await api.deleteEntry(t.id, date);
      setEntries((prev) => prev.filter((e) => e.trackerId !== t.id));
    });
  const savePage = (b: BookWithPage, page: number) =>
    attempt(`b${b.id}`, async () => {
      await api.logPage(b, date, page);
      await refreshBooks();
    });

  const today = todayLocal();
  const active = trackers.filter((t) => !t.archived);
  const reading = books.filter((b) => b.status === 'reading');

  return (
    <div className="today">
      <GoalStrip goals={goals} areas={areas} />

      <div className="date-nav">
        <button type="button" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day">◀</button>
        <input type="date" value={date} max={today} onChange={(e) => e.target.value && setDate(e.target.value)} />
        <button type="button" onClick={() => setDate(addDays(date, 1))} disabled={date >= today} aria-label="Next day">▶</button>
        <span className="date-label">{date === today ? 'Today' : formatDay(date)}</span>
        {date !== today && <button type="button" className="link" onClick={() => setDate(today)}>Back to today</button>}
      </div>

      {loadError && <div className="banner-error">Couldn’t reach the server: {loadError}</div>}

      {areas.map((area) => {
        const own = active.filter((t) => t.areaId === area.id);
        if (own.length === 0) return null;
        return (
          <section key={area.id} className="card area-card" style={{ borderLeftColor: area.color }}>
            <h2>{area.name}</h2>
            {own.map((t) => (
              <TrackerInput
                key={`${t.id}-${date}`}
                tracker={t}
                entry={entries.find((e) => e.trackerId === t.id)}
                onSave={(v, n) => save(t, v, n)}
                onClear={() => clear(t)}
                error={errors[`t${t.id}`]}
              />
            ))}
          </section>
        );
      })}

      {reading.length > 0 && (
        <section className="card area-card" style={{ borderLeftColor: areas.find((a) => a.name === 'Reading')?.color }}>
          <h2>Reading</h2>
          {reading.map((b) => (
            <PageRow key={`${b.id}-${date}`} book={b} onSave={(p) => savePage(b, p)} error={errors[`b${b.id}`]} />
          ))}
        </section>
      )}

      {active.length === 0 && !loadError && <p className="muted">No trackers yet. Add some on the Manage page.</p>}
    </div>
  );
}

function PageRow({ book, onSave, error }: { book: BookWithPage; onSave: (page: number) => void; error?: string }) {
  const [draft, setDraft] = useState(String(book.currentPage));
  useEffect(() => setDraft(String(book.currentPage)), [book.currentPage]);
  const commit = () => {
    if (draft.trim() !== '' && Number(draft) !== book.currentPage) onSave(Number(draft));
  };
  return (
    <div className="tracker">
      <label className="tracker-name" htmlFor={`b${book.id}`}>{book.title}</label>
      <div className="tracker-control quantity">
        <input
          id={`b${book.id}`}
          type="number"
          min={0}
          max={book.totalPages}
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
        />
        <span className="unit">/ {book.totalPages} pages</span>
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
