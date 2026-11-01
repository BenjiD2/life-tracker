import { useEffect, useState, type FormEvent } from 'react';
import { todayLocal } from '../../../shared/dates';
import type { BookStatus, BookWithPage } from '../../../shared/types';
import * as api from '../api';
import { InlineText } from '../components/InlineText';
import { formatDay } from '../format';

export function Books() {
  const [books, setBooks] = useState<BookWithPage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<number, string>>({});

  const refresh = () => api.getBooks().then(setBooks).catch((e) => setError(api.errorMessage(e)));
  useEffect(() => { refresh(); }, []);

  async function attempt(bookId: number, write: () => Promise<unknown>) {
    try {
      await write();
      setRowErrors(({ [bookId]: _, ...rest }) => rest);
      await refresh();
    } catch (e) {
      setRowErrors((prev) => ({ ...prev, [bookId]: api.errorMessage(e) }));
    }
  }

  const reading = books.filter((b) => b.status === 'reading');
  const done = books.filter((b) => b.status === 'done').sort((a, b) => (b.finished ?? '').localeCompare(a.finished ?? ''));
  const dropped = books.filter((b) => b.status === 'dropped');

  const statusSelect = (b: BookWithPage) => (
    <select
      aria-label={`Status of ${b.title}`}
      value={b.status}
      onChange={(e) => attempt(b.id, () => api.updateBook(b.id, { status: e.target.value as BookStatus }))}
    >
      <option value="reading">Reading</option>
      <option value="done">Done</option>
      <option value="dropped">Dropped</option>
    </select>
  );

  return (
    <div>
      {error && <div className="banner-error">{error}</div>}

      <section className="card">
        <h2>Reading now</h2>
        {reading.length === 0 && <p className="muted">Nothing in progress. Add a book below.</p>}
        <ul className="list">
          {reading.map((b) => (
            <li key={b.id} className="stack">
              <div className="row">
                <strong>{b.title}</strong>
                <span className="muted">{b.author}{b.topic ? ` · ${b.topic}` : ''}</span>
                <span style={{ marginLeft: 'auto' }}>{statusSelect(b)}</span>
              </div>
              <span className="bar" title={`${b.currentPage} / ${b.totalPages}`}>
                <span style={{ width: `${(b.currentPage / b.totalPages) * 100}%`, background: 'var(--accent)' }} />
              </span>
              <div className="row">
                <span className="muted">Page</span>
                <InlineText
                  type="number"
                  width="6rem"
                  label={`Page reached in ${b.title}`}
                  value={String(b.currentPage)}
                  onSave={(v) => attempt(b.id, () => api.logPage(b, todayLocal(), Number(v)))}
                />
                <span className="muted">of {b.totalPages} ({Math.round((b.currentPage / b.totalPages) * 100)}%)</span>
              </div>
              {rowErrors[b.id] && <div className="field-error" style={{ gridColumn: 'auto' }}>{rowErrors[b.id]}</div>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Finished</h2>
        {done.length === 0 && <p className="muted">No finished books yet.</p>}
        <ul className="list">
          {done.map((b) => (
            <li key={b.id} className="row">
              <strong>{b.title}</strong>
              <span className="muted">{b.author}{b.topic ? ` · ${b.topic}` : ''}</span>
              <span className="muted" style={{ marginLeft: 'auto' }}>{b.finished ? formatDay(b.finished) : ''}</span>
              {statusSelect(b)}
            </li>
          ))}
        </ul>
      </section>

      {dropped.length > 0 && (
        <section className="card">
          <h2>Dropped</h2>
          <ul className="list">
            {dropped.map((b) => (
              <li key={b.id} className="row">
                <span>{b.title}</span>
                <span className="muted">{b.author}</span>
                <span style={{ marginLeft: 'auto' }}>{statusSelect(b)}</span>
              </li>
            ))}
          </ul>
        </section>
      )}

      <AddBook onAdded={refresh} />
    </div>
  );
}

function AddBook({ onAdded }: { onAdded: () => void }) {
  const [form, setForm] = useState({ title: '', author: '', totalPages: '', topic: '' });
  const [error, setError] = useState<string | null>(null);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  async function submit(e: FormEvent) {
    e.preventDefault();
    try {
      await api.createBook({ title: form.title, author: form.author, totalPages: Number(form.totalPages), topic: form.topic || null });
      setForm({ title: '', author: '', totalPages: '', topic: '' });
      setError(null);
      onAdded();
    } catch (err) {
      setError(api.errorMessage(err));
    }
  }

  return (
    <section className="card">
      <h2>Add a book</h2>
      <form className="row" onSubmit={submit}>
        <input type="text" aria-label="Title" placeholder="Title" value={form.title} onChange={set('title')} />
        <input type="text" aria-label="Author" placeholder="Author" value={form.author} onChange={set('author')} />
        <input type="number" aria-label="Total pages" placeholder="Pages" style={{ width: '6rem' }} value={form.totalPages} onChange={set('totalPages')} />
        <input type="text" aria-label="Topic" placeholder="Topic (optional)" value={form.topic} onChange={set('topic')} />
        <button type="submit" className="primary">Add</button>
      </form>
      {error && <div className="field-error">{error}</div>}
    </section>
  );
}
