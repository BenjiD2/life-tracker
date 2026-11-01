import { formatNumber } from '../format';

/** Progress bar toward `target`, with a marker where a straight-line pace says you should be today. */
export function PaceBar({ current, target, expected, color }: { current: number; target: number; expected: number | null; color: string }) {
  const pct = (n: number) => (target === 0 ? 0 : Math.min(100, (n / target) * 100));
  let pace = '';
  if (expected !== null) {
    // Whole units for the label: "behind by 0.4 books" reads as noise.
    const diff = Math.round(current - expected);
    pace = diff > 0 ? `ahead by ${formatNumber(diff)}` : diff < 0 ? `behind by ${formatNumber(-diff)}` : 'on pace';
  }
  return (
    <div className="pace">
      <div className="pace-track" title={expected === null ? undefined : `Expected today: ${formatNumber(expected)}`}>
        <div className="pace-fill" style={{ width: `${pct(current)}%`, background: color }} />
        {expected !== null && <div className="pace-marker" style={{ left: `calc(${pct(expected)}% - 1px)` }} />}
      </div>
      <div className="row" style={{ fontSize: '0.82rem' }}>
        <span>{formatNumber(current)} / {formatNumber(target)}</span>
        {pace && <span className="muted" style={{ marginLeft: 'auto' }}>{pace}</span>}
      </div>
    </div>
  );
}
