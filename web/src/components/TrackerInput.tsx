import type { Entry, Tracker } from '../../../shared/types';
import { InlineText } from './InlineText';

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
  return (
    <span className="quantity">
      <InlineText
        id={id}
        type="number"
        label={tracker.name}
        placeholder="0"
        value={entry === undefined ? '' : String(entry.value)}
        // Blanking the field clears the day's entry.
        onSave={(v) => (v.trim() === '' ? onClear() : onSave(Number(v), entry?.note ?? null))}
      />
      {tracker.unit && <span className="unit">{tracker.unit}</span>}
    </span>
  );
}
