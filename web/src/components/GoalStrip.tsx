import type { Area, GoalWithProgress } from '../../../shared/types';
import { formatNumber } from '../format';

/** One chip per goal: title and current / target, tinted by its area. */
export function GoalStrip({ goals, areas }: { goals: GoalWithProgress[]; areas: Area[] }) {
  if (goals.length === 0) return null;
  const color = (id: number) => areas.find((a) => a.id === id)?.color ?? 'var(--muted)';
  return (
    <div className="goal-strip">
      {goals.map((g) => (
        <div key={g.id} className="goal-chip" style={{ borderColor: color(g.areaId) }} title={g.title}>
          <span className="goal-chip-title">{g.title}</span>
          <span className="goal-chip-value">
            {formatNumber(g.progress.current)} / {formatNumber(g.progress.target)}
          </span>
          <span className="goal-chip-bar">
            <span style={{ width: `${g.progress.percent}%`, background: color(g.areaId) }} />
          </span>
        </div>
      ))}
    </div>
  );
}
