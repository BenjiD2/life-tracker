import { useEffect, useState, type FormEvent } from 'react';
import type { GoalInput } from '../../../shared/schemas';
import { groupBySubject, isMinuteUnit } from '../../../shared/subjects';
import type { Area, GoalSource, GoalWithProgress, Kind, Period, Tracker } from '../../../shared/types';
import * as api from '../api';
import { InlineText } from '../components/InlineText';
import { formatNumber } from '../format';

/** Wraps a write so its failure lands in a section's error line instead of throwing. */
function useAttempt(after: () => Promise<unknown>) {
  const [error, setError] = useState<string | null>(null);
  async function attempt(write: () => Promise<unknown>) {
    try {
      await write();
      setError(null);
    } catch (e) {
      setError(api.errorMessage(e));
    }
    await after();
  }
  return { error, attempt };
}

export function Manage() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [goals, setGoals] = useState<GoalWithProgress[]>([]);
  const [loadError, setLoadError] = useState<string | null>(null);

  const refresh = () =>
    Promise.all([api.getAreas(), api.getTrackers(), api.getGoals()])
      .then(([a, t, g]) => { setAreas(a); setTrackers(t); setGoals(g); setLoadError(null); })
      .catch((e) => setLoadError(api.errorMessage(e)));
  useEffect(() => { refresh(); }, []);

  return (
    <div>
      {loadError && <div className="banner-error">{loadError}</div>}
      <AreasSection areas={areas} refresh={refresh} />
      <TrackersSection areas={areas} trackers={trackers} refresh={refresh} />
      <GoalsSection areas={areas} trackers={trackers} goals={goals} refresh={refresh} />
    </div>
  );
}

function AreasSection({ areas, refresh }: { areas: Area[]; refresh: () => Promise<unknown> }) {
  const { error, attempt } = useAttempt(refresh);
  const [name, setName] = useState('');
  const [color, setColor] = useState('#888888');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    attempt(async () => { await api.createArea({ name, color }); setName(''); });
  };

  return (
    <section className="card">
      <h2>Areas</h2>
      <ul className="list">
        {areas.map((a) => (
          <li key={a.id} className="row">
            <input type="color" aria-label={`Color of ${a.name}`} value={a.color}
              onChange={(e) => attempt(() => api.updateArea(a.id, { color: e.target.value }))} />
            <InlineText label={`Name of ${a.name}`} value={a.name} onSave={(v) => attempt(() => api.updateArea(a.id, { name: v }))} />
            <button type="button" className="danger" style={{ marginLeft: 'auto' }}
              onClick={() => confirm(`Delete area "${a.name}"?`) && attempt(() => api.deleteArea(a.id))}>
              Delete
            </button>
          </li>
        ))}
      </ul>
      <form className="row" onSubmit={submit} style={{ marginTop: '0.6rem' }}>
        <input type="color" aria-label="New area color" value={color} onChange={(e) => setColor(e.target.value)} />
        <input type="text" aria-label="New area name" placeholder="New area" value={name} onChange={(e) => setName(e.target.value)} />
        <button type="submit" className="primary">Add area</button>
      </form>
      {error && <div className="field-error">{error}</div>}
    </section>
  );
}

function TrackersSection({ areas, trackers, refresh }: { areas: Area[]; trackers: Tracker[]; refresh: () => Promise<unknown> }) {
  const { error, attempt } = useAttempt(refresh);
  const [form, setForm] = useState<{ areaId: string; name: string; kind: Kind; unit: string; subject: string; minutesPerUnit: string }>(
    { areaId: '', name: '', kind: 'check', unit: '', subject: '', minutesPerUnit: '' },
  );
  const formAreaId = Number(form.areaId || areas[0]?.id);
  const showMinutesPerUnit = (unit: string | null, current: number | null) => !isMinuteUnit(unit) || current !== null;
  const subjectsList = (areaId: number) => `subjects-${areaId}`;
  const minutesOrNull = (v: string) => (v.trim() ? Number(v) : null);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    attempt(async () => {
      const quantity = form.kind === 'quantity';
      await api.createTracker({
        areaId: formAreaId,
        name: form.name,
        kind: form.kind,
        unit: quantity && form.unit ? form.unit : null,
        subject: form.subject,
        minutesPerUnit: quantity && showMinutesPerUnit(form.unit, null) ? minutesOrNull(form.minutesPerUnit) : null,
      });
      setForm({ ...form, name: '', unit: '', minutesPerUnit: '' });
    });
  };

  const row = (t: Tracker) => (
    <li key={t.id} className="row">
      <InlineText label={`Name of ${t.name}`} value={t.name} onSave={(v) => attempt(() => api.updateTracker(t.id, { name: v }))} />
      <select aria-label={`Area of ${t.name}`} value={t.areaId}
        onChange={(e) => attempt(() => api.updateTracker(t.id, { areaId: Number(e.target.value) }))}>
        {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
      </select>
      <span className="muted" title="Kind can't change after creation">{t.kind}</span>
      {t.kind === 'quantity' && (
        <InlineText label={`Unit of ${t.name}`} width="7rem" placeholder="unit" value={t.unit ?? ''}
          onSave={(v) => attempt(() => api.updateTracker(t.id, { unit: v.trim() || null }))} />
      )}
      {t.kind === 'quantity' && showMinutesPerUnit(t.unit, t.minutesPerUnit) && (
        <label className="row muted" title="Estimated minutes per unit, for estimated total time">≈
          <InlineText type="number" label={`Estimated minutes per unit of ${t.name}`} width="4.5rem" placeholder="—"
            value={t.minutesPerUnit === null ? '' : String(t.minutesPerUnit)}
            onSave={(v) => attempt(() => api.updateTracker(t.id, { minutesPerUnit: minutesOrNull(v) }))} />
          min each
        </label>
      )}
      <InlineText label={`Subject of ${t.name}`} width="7rem" placeholder="subject" list={subjectsList(t.areaId)}
        value={t.subject ?? ''} onSave={(v) => attempt(() => api.updateTracker(t.id, { subject: v }))} />
      <button type="button" style={{ marginLeft: 'auto' }}
        onClick={() => attempt(() => api.updateTracker(t.id, { archived: !t.archived }))}>
        {t.archived ? 'Unarchive' : 'Archive'}
      </button>
    </li>
  );

  const active = trackers.filter((t) => !t.archived);
  const archived = trackers.filter((t) => t.archived);

  return (
    <section className="card">
      <h2>Trackers</h2>
      {areas.map((a) => {
        const own = active.filter((t) => t.areaId === a.id);
        return own.length === 0 ? null : (
          <div key={a.id} style={{ marginBottom: '0.6rem' }}>
            <h3 style={{ fontSize: '0.9rem', color: 'var(--muted)' }}>{a.name}</h3>
            <ul className="list">{own.map(row)}</ul>
          </div>
        );
      })}
      {areas.map((a) => (
        <datalist key={a.id} id={subjectsList(a.id)}>
          {groupBySubject(trackers.filter((t) => t.areaId === a.id)).flatMap((g) => (g.label === null ? [] : [<option key={g.key} value={g.label} />]))}
        </datalist>
      ))}
      <form className="row" onSubmit={submit} style={{ marginTop: '0.6rem' }}>
        <select aria-label="New tracker area" value={form.areaId || areas[0]?.id || ''} onChange={(e) => setForm({ ...form, areaId: e.target.value })}>
          {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
        </select>
        <input type="text" aria-label="New tracker name" placeholder="New tracker" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        <select aria-label="New tracker kind" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Kind })}>
          <option value="check">Check</option>
          <option value="quantity">Quantity</option>
          <option value="rating">Rating 1–5</option>
        </select>
        {form.kind === 'quantity' && (
          <input type="text" aria-label="New tracker unit" placeholder="unit (e.g. minutes)" value={form.unit} onChange={(e) => setForm({ ...form, unit: e.target.value })} />
        )}
        {form.kind === 'quantity' && showMinutesPerUnit(form.unit, null) && (
          <label className="row muted">≈
            <input type="number" aria-label="New tracker estimated minutes per unit" placeholder="—" style={{ width: '4.5rem' }}
              value={form.minutesPerUnit} onChange={(e) => setForm({ ...form, minutesPerUnit: e.target.value })} />
            min each
          </label>
        )}
        <input type="text" aria-label="New tracker subject" placeholder="subject (optional)" list={subjectsList(formAreaId)} style={{ width: '9rem' }}
          value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        <button type="submit" className="primary">Add tracker</button>
      </form>
      {error && <div className="field-error">{error}</div>}
      {archived.length > 0 && (
        <details style={{ marginTop: '0.8rem' }}>
          <summary className="muted">Archived ({archived.length})</summary>
          <ul className="list">{archived.map((t) => (
            <li key={t.id} className="row">
              <span>{t.name}</span>
              <select aria-label={`Area of ${t.name}`} value={t.areaId}
                onChange={(e) => attempt(() => api.updateTracker(t.id, { areaId: Number(e.target.value) }))}>
                {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
              </select>
              <span className="muted">{t.kind}</span>
              <button type="button" style={{ marginLeft: 'auto' }} onClick={() => attempt(() => api.updateTracker(t.id, { archived: false }))}>Unarchive</button>
            </li>
          ))}</ul>
        </details>
      )}
    </section>
  );
}

interface GoalForm {
  title: string;
  areaId: string;
  type: 'consistency' | 'completion';
  period: Period;
  targetDays: string;
  scopeTrackerId: string;
  source: GoalSource;
  target: string;
  deadline: string;
  sourceTrackerId: string;
  bookTopic: string;
}
const emptyGoal: GoalForm = {
  title: '', areaId: '', type: 'consistency', period: 'month', targetDays: '', scopeTrackerId: '',
  source: 'books', target: '', deadline: '', sourceTrackerId: '', bookTopic: '',
};

/** Turns the form's strings into the API's discriminated union; the server does the validating. */
function toGoalInput(f: GoalForm, fallbackAreaId: number): GoalInput {
  const base = { title: f.title, areaId: Number(f.areaId) || fallbackAreaId };
  if (f.type === 'consistency') {
    return { ...base, type: 'consistency', period: f.period, targetDays: Number(f.targetDays),
      scopeTrackerId: f.scopeTrackerId ? Number(f.scopeTrackerId) : null };
  }
  return {
    ...base,
    type: 'completion',
    source: f.source,
    target: f.source === 'checklist' ? null : Number(f.target),
    deadline: f.deadline || null,
    sourceTrackerId: f.source === 'tracker' ? Number(f.sourceTrackerId) || null : null,
    bookTopic: f.source === 'books' && f.bookTopic ? f.bookTopic : null,
  };
}

function GoalsSection({ areas, trackers, goals, refresh }: {
  areas: Area[]; trackers: Tracker[]; goals: GoalWithProgress[]; refresh: () => Promise<unknown>;
}) {
  const { error, attempt } = useAttempt(refresh);
  const [f, setF] = useState<GoalForm>(emptyGoal);
  const set = <K extends keyof GoalForm>(k: K, v: GoalForm[K]) => setF((prev) => ({ ...prev, [k]: v }));
  const areaId = Number(f.areaId) || areas[0]?.id || 0;
  const areaTrackers = trackers.filter((t) => t.areaId === areaId);
  const quantityTrackers = trackers.filter((t) => t.kind === 'quantity');

  const submit = (e: FormEvent) => {
    e.preventDefault();
    attempt(async () => { await api.createGoal(toGoalInput(f, areaId)); setF({ ...emptyGoal, areaId: f.areaId }); });
  };

  return (
    <section className="card">
      <h2>Goals</h2>
      <ul className="list">
        {goals.map((g) => <GoalRow key={g.id} goal={g} areas={areas} attempt={attempt} />)}
      </ul>

      <form className="stack" onSubmit={submit} style={{ marginTop: '0.8rem' }}>
        <div className="row">
          <input type="text" aria-label="Goal title" placeholder="New goal title" value={f.title} onChange={(e) => set('title', e.target.value)} />
          <select aria-label="Goal area" value={areaId} onChange={(e) => setF((prev) => ({ ...prev, areaId: e.target.value, scopeTrackerId: '' }))}>
            {areas.map((a) => <option key={a.id} value={a.id}>{a.name}</option>)}
          </select>
          <select aria-label="Goal type" value={f.type} onChange={(e) => set('type', e.target.value as GoalForm['type'])}>
            <option value="consistency">Keep it up (days per period)</option>
            <option value="completion">Get it done (reach a total)</option>
          </select>
        </div>
        {f.type === 'consistency' ? (
          <div className="row">
            <input type="number" aria-label="Target days" placeholder="days" style={{ width: '5rem' }} value={f.targetDays} onChange={(e) => set('targetDays', e.target.value)} />
            <span className="muted">active days per</span>
            <select aria-label="Period" value={f.period} onChange={(e) => set('period', e.target.value as Period)}>
              <option value="week">week</option>
              <option value="month">month</option>
            </select>
            <span className="muted">counting</span>
            <select aria-label="Scope" value={f.scopeTrackerId} onChange={(e) => set('scopeTrackerId', e.target.value)}>
              <option value="">any tracker in the area</option>
              {areaTrackers.map((t) => <option key={t.id} value={t.id}>only {t.name}</option>)}
            </select>
          </div>
        ) : (
          <div className="row">
            <select aria-label="Source" value={f.source} onChange={(e) => set('source', e.target.value as GoalSource)}>
              <option value="books">Books finished</option>
              <option value="tracker">Tracker total</option>
              <option value="checklist">Checklist</option>
            </select>
            {f.source === 'tracker' && (
              <select aria-label="Source tracker" value={f.sourceTrackerId} onChange={(e) => set('sourceTrackerId', e.target.value)}>
                <option value="">choose tracker…</option>
                {quantityTrackers.map((t) => <option key={t.id} value={t.id}>{t.name}{t.unit ? ` (${t.unit})` : ''}</option>)}
              </select>
            )}
            {f.source !== 'checklist' && (
              <input type="number" aria-label="Target" placeholder="target" style={{ width: '6rem' }} value={f.target} onChange={(e) => set('target', e.target.value)} />
            )}
            {f.source === 'books' && (
              <input type="text" aria-label="Book topic" placeholder="topic (optional)" value={f.bookTopic} onChange={(e) => set('bookTopic', e.target.value)} />
            )}
            <span className="muted">by</span>
            <input type="date" aria-label="Deadline" value={f.deadline} onChange={(e) => set('deadline', e.target.value)} />
          </div>
        )}
        <div><button type="submit" className="primary">Add goal</button></div>
      </form>
      {error && <div className="field-error">{error}</div>}
    </section>
  );
}

function GoalRow({ goal: g, areas, attempt }: {
  goal: GoalWithProgress; areas: Area[]; attempt: (w: () => Promise<unknown>) => Promise<void>;
}) {
  const [newItem, setNewItem] = useState('');
  const area = areas.find((a) => a.id === g.areaId);
  const describe =
    g.type === 'consistency'
      ? `${g.targetDays} days / ${g.period}`
      : g.source === 'checklist'
        ? 'checklist'
        : `${g.source === 'books' ? 'books' : 'tracker total'}`;

  return (
    <li className="stack">
      <div className="row">
        <span style={{ width: 10, height: 10, borderRadius: 5, background: area?.color }} />
        <InlineText label={`Title of ${g.title}`} value={g.title} onSave={(v) => attempt(() => api.updateGoal(g.id, { title: v }))} />
        <span className="muted">{area?.name} · {describe}</span>
        <strong style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>
          {formatNumber(g.progress.current)} / {formatNumber(g.progress.target)}
        </strong>
        <button type="button" className="danger" onClick={() => confirm(`Delete goal "${g.title}"?`) && attempt(() => api.deleteGoal(g.id))}>Delete</button>
      </div>
      <div className="row">
        {g.type === 'consistency' && (
          <label className="row muted">Target days
            <InlineText type="number" width="5rem" label="Target days" value={String(g.targetDays ?? '')}
              onSave={(v) => attempt(() => api.updateGoal(g.id, { targetDays: Number(v) }))} />
          </label>
        )}
        {g.type === 'completion' && g.source !== 'checklist' && (
          <label className="row muted">Target
            <InlineText type="number" width="6rem" label="Target" value={String(g.target ?? '')}
              onSave={(v) => attempt(() => api.updateGoal(g.id, { target: Number(v) }))} />
          </label>
        )}
        {g.type === 'completion' && (
          <label className="row muted">Deadline
            <InlineText type="date" label="Deadline" value={g.deadline ?? ''}
              onSave={(v) => attempt(() => api.updateGoal(g.id, { deadline: v || null }))} />
          </label>
        )}
      </div>
      {g.source === 'checklist' && (
        <div style={{ paddingLeft: '1.2rem' }}>
          <ul className="list">
            {g.items.map((it) => (
              <li key={it.id} className="row">
                <input type="checkbox" aria-label={`Done: ${it.label}`} checked={it.doneAt !== null}
                  onChange={(e) => attempt(() => api.updateGoalItem(it.id, { done: e.target.checked }))} />
                <InlineText label={`Label of ${it.label}`} value={it.label} onSave={(v) => attempt(() => api.updateGoalItem(it.id, { label: v }))} />
                <button type="button" className="link danger" style={{ marginLeft: 'auto' }} onClick={() => attempt(() => api.deleteGoalItem(it.id))}>remove</button>
              </li>
            ))}
          </ul>
          <form className="row" onSubmit={(e) => { e.preventDefault(); attempt(async () => { await api.createGoalItem(g.id, { label: newItem }); setNewItem(''); }); }}>
            <input type="text" aria-label="New item" placeholder="New item" value={newItem} onChange={(e) => setNewItem(e.target.value)} />
            <button type="submit">Add item</button>
          </form>
        </div>
      )}
    </li>
  );
}
