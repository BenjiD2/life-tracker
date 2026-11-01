import { addDays, periodBounds } from '../../../shared/dates';
import type { DateStr } from '../../../shared/types';

export type RangeKey = '4w' | '12w' | '6m' | 'ytd' | '12m' | 'custom';

export const PRESETS: { key: Exclude<RangeKey, 'custom'>; label: string }[] = [
  { key: '4w', label: 'Last 4 weeks' },
  { key: '12w', label: 'Last 12 weeks' },
  { key: '6m', label: 'Last 6 months' },
  { key: 'ytd', label: 'This year' },
  { key: '12m', label: 'Last 12 months' },
];

/** The [from, to] a preset means on `today`. Week presets start on a Monday so the first bar is a full week. */
export function presetRange(key: Exclude<RangeKey, 'custom'>, today: DateStr): { from: DateStr; to: DateStr } {
  const monday = periodBounds(today, 'week').start;
  switch (key) {
    case '4w': return { from: addDays(monday, -7 * 3), to: today };
    case '12w': return { from: addDays(monday, -7 * 11), to: today };
    case '6m': return { from: addDays(monday, -7 * 25), to: today };
    case 'ytd': return { from: `${today.slice(0, 4)}-01-01`, to: today };
    case '12m': {
      // The current month plus the 11 before it: 12 monthly bars.
      const [y, m] = today.split('-').map(Number);
      const back = m - 11 <= 0 ? { y: y - 1, m: m + 1 } : { y, m: m - 11 };
      return { from: `${back.y}-${String(back.m).padStart(2, '0')}-01`, to: today };
    }
  }
}

/** One row of time controls above the charts: preset buttons, plus from/to inputs for a custom range. */
export function RangeFilter({ range, from, to, today, onPreset, onCustom }: {
  range: RangeKey;
  from: DateStr;
  to: DateStr;
  today: DateStr;
  onPreset: (key: Exclude<RangeKey, 'custom'>) => void;
  onCustom: (from: DateStr, to: DateStr) => void;
}) {
  return (
    <div className="range-filter" role="group" aria-label="Time range">
      {PRESETS.map((p) => (
        <button key={p.key} type="button" className={range === p.key ? 'on' : ''} aria-pressed={range === p.key} onClick={() => onPreset(p.key)}>
          {p.label}
        </button>
      ))}
      <span className="range-custom">
        <input type="date" aria-label="From" value={from} max={to} onChange={(e) => e.target.value && onCustom(e.target.value, to)} />
        <span className="muted">to</span>
        <input type="date" aria-label="To" value={to} min={from} max={today} onChange={(e) => e.target.value && onCustom(from, e.target.value)} />
      </span>
    </div>
  );
}
