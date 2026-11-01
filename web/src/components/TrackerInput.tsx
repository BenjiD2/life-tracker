import { useEffect, useState } from 'react';
import type { Entry, Tracker } from '../../../shared/types';

interface Props {
  tracker: Tracker;
  entry: Entry | undefined;
  onSave: (value: number, note: string | null) => void;
  onClear: () => void;
  error?: string;
}

/** The input a tracker's kind calls for (spec §3): checkbox, number with unit, or 1–5 buttons. */
export function TrackerInput({ tracker, entry, onSave, onClear, error }: Props) {
  const note = entry?.note ?? null;
  return (
    <div className="tracker">
      <label className="tracker-name" htmlFor={`t${tracker.id}`}>{tracker.name}</label>
      <div className="tracker-control">
        {tracker.kind === 'check' && (
          <input
            id={`t${tracker.id}`}
            type="checkbox"
            checked={entry !== undefined}
            onChange={(e) => (e.target.checked ? onSave(1, note) : onClear())}
          />
        )}
        {tracker.kind === 'quantity' && <QuantityField id={`t${tracker.id}`} tracker={tracker} entry={entry} onSave={onSave} onClear={onClear} />}
        {tracker.kind === 'rating' && (
          <div className="rating" role="group" aria-label={tracker.name}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button
                key={n}
                type="button"
                className={entry?.value === n ? 'on' : ''}
                aria-pressed={entry?.value === n}
                // Clicking the selected rating again clears it.
                onClick={() => (entry?.value === n ? onClear() : onSave(n, note))}
              >
                {n}
              </button>
            ))}
          </div>
        )}
      </div>
      {error && <div className="field-error">{error}</div>}
    </div>
  );
}

function QuantityField({ id, tracker, entry, onSave, onClear }: Omit<Props, 'error'> & { id: string }) {
  const saved = entry === undefined ? '' : String(entry.value);
  const [draft, setDraft] = useState(saved);
  useEffect(() => setDraft(saved), [saved]);

  function commit() {
    const text = draft.trim();
    if (text === saved) return;
    if (text === '') onClear();
    else onSave(Number(text), entry?.note ?? null);
  }

  return (
    <span className="quantity">
      <input
        id={id}
        type="number"
        inputMode="decimal"
        value={draft}
        placeholder="0"
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => e.key === 'Enter' && e.currentTarget.blur()}
      />
      {tracker.unit && <span className="unit">{tracker.unit}</span>}
    </span>
  );
}
