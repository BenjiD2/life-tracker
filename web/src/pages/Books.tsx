import { useEffect, useState, type FormEvent } from 'react';
import { todayLocal } from '../../../shared/dates';
import type { BookPatch } from '../../../shared/schemas';
import type { BookStatus, BookWithPage } from '../../../shared/types';
import * as api from '../api';
import { InlineText } from '../components/InlineText';
import { formatDay } from '../format';
import { logPage } from '../logPage';
import { useAttempt } from '../useAttempt';

export function Books() {
  const [books, setBooks] = useState<BookWithPage[]>([]);
  const [error, setError] = useState<string | null>(null);

  const refresh = () => api.getBooks().then(setBooks).catch((e) => setError(api.errorMessage(e)));
  useEffect(() => { refresh(); }, []);

  const { errors: rowErrors, attempt } = useAttempt(refresh);

  const reading = books.filter((b) => b.status === 'reading');
  const done = books.filter((b) => b.status === 'done').sort((a, b) => (b.finished ?? '').localeCompare(a.finished ?? ''));
  const dropped = books.filter((b) => b.status === 'dropped');

  const [editing, setEditing] = useState<number | null>(null);
  const editButton = (b: BookWithPage) => (
    <button type="button" className="link" onClick={() => setEditing(editing === b.id ? null : b.id)}>
      {editing === b.id ? 'Done editing' : 'Edit'}
    </button>
  );
  const editor = (b: BookWithPage) =>
    editing === b.id && (
      <BookEditor book={b} save={(patch) => attempt(String(b.id), () => api.updateBook(b.id, patch))} error={rowErrors[b.id]} />
    );

  const statusSelect = (b: BookWithPage) => (
    <select
      aria-label={`Status of ${b.title}`}
      value={b.status}
      onChange={(e) => attempt(String(b.id), () => api.updateBook(b.id, { status: e.target.value as BookStatus }))}
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
                <span style={{ marginLeft: 'auto' }}>{editButton(b)} {statusSelect(b)}</span>
              </div>
              {editor(b)}
              <span className="bar" title={`${b.currentPage} / ${b.totalPages}`}>
                <span style={{ width: `${(b.currentPage / b.totalPages) * 100}%`, background: 'var(--accent)' }} />
              </span>
              <div className="row">
                <span className="muted">Page</span>
                <InlineText
                  type="number"
                  width="6rem"
                  label={`Page reached in ${b.title}`}
                  required
                  value={String(b.currentPage)}
                  onSave={(v) => attempt(String(b.id), () => logPage(b, todayLocal(), Number(v)))}
                />
                <span className="muted">of {b.totalPages} ({Math.round((b.currentPage / b.totalPages) * 100)}%)</span>
              </div>
              {editing !== b.id && rowErrors[b.id] && <div className="field-error" style={{ gridColumn: 'auto' }}>{rowErrors[b.id]}</div>}
            </li>
          ))}
        </ul>
      </section>

      <section className="card">
        <h2>Finished</h2>
        {done.length === 0 && <p className="muted">No finished books yet.</p>}
        <ul className="list">
          {done.map((b) => (
            <li key={b.id} className="stack">
              <div className="row">
                <strong>{b.title}</strong>
                <span className="muted">{b.author}{b.topic ? ` · ${b.topic}` : ''}</span>
                <span className="muted" style={{ marginLeft: 'auto' }}>{b.finished ? formatDay(b.finished) : ''}</span>
                {editButton(b)}
                {statusSelect(b)}
              </div>
              {editor(b)}
            </li>
          ))}
        </ul>
      </section>

      {dropped.length > 0 && (
        <section className="card">
          <h2>Dropped</h2>
          <ul className="list">
            {dropped.map((b) => (
              <li key={b.id} className="stack">
                <div className="row">
                  <span>{b.title}</span>
                  <span className="muted">{b.author}</span>
                  <span style={{ marginLeft: 'auto' }}>{editButton(b)} {statusSelect(b)}</span>
                </div>
                {editor(b)}
              </li>
            ))}
          </ul>
        </section>
      )}

      <AddBook onAdded={refresh} />
    </div>
  );
}

function AddBook({ onAdded }: { onAdded: () => Promise<unknown> }) {
  const [form, setForm] = useState({ title: '', author: '', totalPages: '', startPage: '', topic: '' });
  const { errors, attempt } = useAttempt(onAdded);
  const set = (k: keyof typeof form) => (e: { target: { value: string } }) => setForm({ ...form, [k]: e.target.value });

  function submit(e: FormEvent) {
    e.preventDefault();
    attempt('add', async () => {
      await api.createBook({
        title: form.title, author: form.author, totalPages: Number(form.totalPages), topic: form.topic || null,
        startPage: form.startPage ? Number(form.startPage) : undefined,
      });
      setForm({ title: '', author: '', totalPages: '', startPage: '', topic: '' });
    });
  }

  return (
    <section className="card">
      <h2>Add a book</h2>
      <form className="row" onSubmit={submit}>
        <input type="text" aria-label="Title" placeholder="Title" value={form.title} onChange={set('title')} />
        <input type="text" aria-label="Author" placeholder="Author" value={form.author} onChange={set('author')} />
        <input type="number" aria-label="Total pages" placeholder="Pages" style={{ width: '6rem' }} value={form.totalPages} onChange={set('totalPages')} />
        <input type="number" aria-label="Already at page" placeholder="Already at page" title="If you started before tracking, the page you're on now" style={{ width: '9rem' }} value={form.startPage} onChange={set('startPage')} />
        <input type="text" aria-label="Topic" placeholder="Topic (optional)" value={form.topic} onChange={set('topic')} />
        <button type="submit" className="primary">Add</button>
      </form>
      {errors.add && <div className="field-error">{errors.add}</div>}
    </section>
  );
}

/** Inline fields for a book's details; each saves on blur. Errors (e.g. pages below a logged page) show underneath. */
function BookEditor({ book, save, error }: { book: BookWithPage; save: (patch: BookPatch) => void; error?: string }) {
  return (
    <div className="stack" style={{ padding: '0.4rem 0 0.2rem' }}>
      <div className="row">
        <label className="row muted">Title
          <InlineText label="Title" value={book.title} onSave={(v) => save({ title: v })} />
        </label>
        <label className="row muted">Author
          <InlineText label="Author" value={book.author} onSave={(v) => save({ author: v })} />
        </label>
        <label className="row muted">Pages
          <InlineText type="number" width="6rem" label="Total pages" required value={String(book.totalPages)} onSave={(v) => save({ totalPages: Number(v) })} />
        </label>
        <label className="row muted" title="Page you were on when you started tracking this book">Started at page
          <InlineText type="number" width="5rem" label="Started at page" required value={String(book.startPage)} onSave={(v) => save({ startPage: Number(v) })} />
        </label>
        <label className="row muted">Topic
          <InlineText label="Topic" width="8rem" placeholder="none" value={book.topic ?? ''} onSave={(v) => save({ topic: v.trim() || null })} />
        </label>
      </div>
      {error && <div className="field-error" style={{ gridColumn: 'auto' }}>{error}</div>}
    </div>
  );
}
