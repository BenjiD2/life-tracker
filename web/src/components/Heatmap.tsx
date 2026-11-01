import { addDays, daysBetween, periodBounds } from '../../../shared/dates';
import type { DateStr } from '../../../shared/types';
import { formatDay } from '../format';

const CELL = 11;
const GAP = 2; // surface gap between cells
const STEP = CELL + GAP;
const LEFT = 18; // room for weekday labels
const TOP = 14; // room for month labels
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/**
 * Calendar of active days: one column per week (Monday on top), ending with the week of `end`.
 * Binary encoding: the area's color for an active day, the empty-cell token otherwise.
 */
export function Heatmap({ dates, start, end, color }: { dates: DateStr[]; start: DateStr; end: DateStr; color: string }) {
  const active = new Set(dates);
  const firstMonday = periodBounds(start, 'week').start;
  const weeks = daysBetween(firstMonday, periodBounds(end, 'week').start) / 7 + 1;
  const cells: { d: DateStr; col: number; row: number }[] = [];
  const monthLabels: { col: number; label: string }[] = [];

  for (let col = 0; col < weeks; col++) {
    const monday = addDays(firstMonday, col * 7);
    for (let row = 0; row < 7; row++) {
      const d = addDays(monday, row);
      if (d > end) break;
      if (d < start) continue;
      cells.push({ d, col, row });
      // Label a column when its week contains the 1st of a month.
      if (d.endsWith('-01')) monthLabels.push({ col, label: MONTHS[Number(d.slice(5, 7)) - 1] });
    }
  }

  const width = LEFT + weeks * STEP;
  const height = TOP + 7 * STEP;
  return (
    <div className="heatmap-wrap">
      <svg className="heatmap" width={width} height={height} role="img"
        aria-label={`${dates.length} active days from ${formatDay(start)} to ${formatDay(end)}`}>
        {monthLabels.map((m) => <text key={`${m.col}${m.label}`} x={LEFT + m.col * STEP} y={9}>{m.label}</text>)}
        {['Mon', 'Wed', 'Fri'].map((label, i) => <text key={label} x={0} y={TOP + i * 2 * STEP + 9}>{label[0]}</text>)}
        {cells.map(({ d, col, row }) => (
          <rect key={d} x={LEFT + col * STEP} y={TOP + row * STEP} width={CELL} height={CELL} rx={2}
            fill={active.has(d) ? color : 'var(--cell-empty)'}>
            <title>{`${formatDay(d)}${active.has(d) ? ' · active' : ''}`}</title>
          </rect>
        ))}
      </svg>
    </div>
  );
}
