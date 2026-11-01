import { useEffect, useState } from 'react';
import { isBooksArea } from '../../../shared/books-area';
import { addDays, todayLocal } from '../../../shared/dates';
import { groupBySubject } from '../../../shared/subjects';
import type { Area, BookWithPage, DateStr, Entry, GoalWithProgress, Tracker } from '../../../shared/types';
import * as api from '../api';
import { GoalStrip } from '../components/GoalStrip';
import { InlineText } from '../components/InlineText';
import { TrackerInput } from '../components/TrackerInput';
import { formatDay } from '../format';
import { logPage } from '../logPage';
import { useAttempt } from '../useAttempt';

export function Today() {
  const [date, setDate] = useState<DateStr>(() => todayLocal());
  const [areas, setAreas] = useState<Area[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [books, setBooks] = useState<BookWithPage[]>([]);
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  /** The goal strip and reading rows depend on every write. */
  const refreshProgress = () =>
    Promise.all([api.getGoals(), api.getBooks()])
      .then(([g, b]) => { setGoals(g); setBooks(b); })
      .catch((e) => setLoadError(api.errorMessage(e)));
  const { errors, attempt, clearErrors } = useAttempt(refreshProgress);

  useEffect(() => {
    Promise.all([api.getAreas(), api.getTrackers()])
      .then(([a, t]) => { setAreas(a); setTrackers(t); })
      .catch((e) => setLoadError(api.errorMessage(e)));
    refreshProgress();
  }, []);

  useEffect(() => {
    let live = true;
    clearErrors();
    api.getEntries(date).then((e) => live && setEntries(e)).catch((e) => setLoadError(api.errorMessage(e)));
    return () => { live = false; };
  }, [date]);

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
  const savePage = (b: BookWithPage, page: number) => attempt(`b${b.id}`, () => logPage(b, date, page));

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
            {groupBySubject(own, trackers.filter((t) => t.areaId === area.id)).map((g) => (
              <div key={g.key ?? ''}>
                {g.label !== null && <h3 className="subject-head">{g.label}</h3>}
                {g.trackers.map((t) => (
                  <TrackerInput
                    key={`${t.id}-${date}`}
                    tracker={t}
                    entry={entries.find((e) => e.trackerId === t.id)}
                    onSave={(v, n) => save(t, v, n)}
                    onClear={() => clear(t)}
                    error={errors[`t${t.id}`]}
                  />
                ))}
              </div>
            ))}
          </section>
        );
      })}

      {reading.length > 0 && (
        <section className="card area-card" style={{ borderLeftColor: areas.find(isBooksArea)?.color }}>
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
  return (
    <div className="tracker">
      <label className="tracker-name" htmlFor={`b${book.id}`}>{book.title}</label>
      <div className="tracker-control quantity">
        <InlineText
          id={`b${book.id}`}
          type="number"
          label={book.title}
          min={0}
          max={book.totalPages}
          required
          value={String(book.currentPage)}
          onSave={(v) => onSave(Number(v))}
        />
        <span className="unit">/ {book.totalPages} pages</span>
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}
