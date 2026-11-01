import { useEffect, useState } from 'react';
import { addDays } from '../../../shared/dates';
import type { Area, DashboardData, GoalWithProgress, Tracker } from '../../../shared/types';
import * as api from '../api';
import { Heatmap } from '../components/Heatmap';
import { PaceBar } from '../components/PaceBar';
import { ProgressRing } from '../components/ProgressRing';
import { TrendChart, type Series } from '../components/TrendChart';
import { formatShort } from '../format';

// Categorical slots in fixed order (dataviz reference palette); a series keeps its slot by tracker order, never by rank.
const SLOTS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

export function Dashboard() {
  const [data, setData] = useState<DashboardData | null>(null);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([api.getDashboard(), api.getTrackers()])
      .then(([d, t]) => { setData(d); setTrackers(t); })
      .catch((e) => setError(api.errorMessage(e)));
  }, []);

  if (error) return <div className="banner-error">{error}</div>;
  if (!data) return <p className="muted">Loading…</p>;

  const hasReadingArea = data.areas.some((a) => a.area.name.toLowerCase() === 'reading');
  return (
    <div className="dash-grid">
      {data.areas.map(({ area, activeDates }) => (
        <AreaCard
          key={area.id}
          area={area}
          activeDates={activeDates}
          data={data}
          trackers={trackers.filter((t) => t.areaId === area.id)}
          showPages={area.name.toLowerCase() === 'reading'}
        />
      ))}
      {!hasReadingArea && data.pagesPerWeek.some((w) => w.pages > 0) && (
        <section className="card"><PagesChart data={data} color="var(--series-1)" /></section>
      )}
    </div>
  );
}

function AreaCard({ area, activeDates, data, trackers, showPages }: {
  area: Area; activeDates: string[]; data: DashboardData; trackers: Tracker[]; showPages: boolean;
}) {
  const goals = data.goals.filter((g) => g.areaId === area.id);
  const ids = new Set(trackers.map((t) => t.id));

  // Quantity trackers with any minutes in the window, or still active, stacked per week.
  const quantity = trackers.filter(
    (t) => t.kind === 'quantity' && (!t.archived || data.weeklyTotals.some((w) => w.trackerId === t.id && w.total > 0)),
  );
  const weeks = [...new Set(data.weeklyTotals.map((w) => w.weekStart))];
  const weeklyRows = weeks.map((x) => {
    const row: Record<string, string | number> = { x };
    for (const t of quantity) row[`t${t.id}`] = data.weeklyTotals.find((w) => w.trackerId === t.id && w.weekStart === x)?.total ?? 0;
    return row;
  });
  const anyMinutes = weeklyRows.some((r) => quantity.some((t) => Number(r[`t${t.id}`]) > 0));
  const units = [...new Set(quantity.map((t) => t.unit ?? ''))];

  const ratings = trackers.filter((t) => t.kind === 'rating');
  const mood = data.mood.filter((m) => ids.has(m.trackerId));
  // Every day of the 90-day window is a category, so spacing on the axis is proportional to time.
  const moodRows = Array.from({ length: 90 }, (_, i) => addDays(data.today, i - 89)).map((x) => {
    const row: Record<string, string | number> = { x };
    for (const m of mood.filter((m) => m.date === x)) row[`t${m.trackerId}`] = m.value;
    return row;
  });

  return (
    <section className="card area-card" style={{ borderLeftColor: area.color }}>
      <div className="dash-head">
        <span className="swatch" style={{ background: area.color }} />
        <h2>{area.name}</h2>
        <span className="muted" style={{ fontSize: '0.85rem' }}>{activeDates.length} active days this year</span>
      </div>
      <Heatmap dates={activeDates} end={data.today} color={area.color} />

      {goals.length > 0 && (
        <div className="goal-tiles">{goals.map((g) => <GoalTile key={g.id} goal={g} color={area.color} />)}</div>
      )}

      {quantity.length > 0 && anyMinutes && (
        <>
          <div className="chart-title">Weekly totals{units.length === 1 && units[0] ? ` (${units[0]})` : ''}, last 12 weeks</div>
          <TrendChart
            kind="bar"
            data={weeklyRows}
            series={quantity.map((t, i): Series => ({ key: `t${t.id}`, label: t.name, color: SLOTS[i % SLOTS.length] }))}
            xFormat={formatShort}
            unit={units.length === 1 ? units[0] : undefined}
          />
        </>
      )}

      {ratings.length > 0 && mood.length > 0 && (
        <>
          <div className="chart-title">{ratings.length === 1 ? ratings[0].name : 'Ratings'}, last 90 days</div>
          <TrendChart
            kind="line"
            data={moodRows}
            series={ratings.map((t, i): Series => ({ key: `t${t.id}`, label: t.name, color: ratings.length === 1 ? area.color : SLOTS[i % SLOTS.length] }))}
            xFormat={formatShort}
            yDomain={[1, 5]}
            yTicks={[1, 2, 3, 4, 5]}
          />
        </>
      )}

      {showPages && <PagesChart data={data} color={area.color} />}
    </section>
  );
}

function PagesChart({ data, color }: { data: DashboardData; color: string }) {
  return (
    <>
      <div className="chart-title">Pages read per week, last 12 weeks</div>
      <TrendChart
        kind="bar"
        data={data.pagesPerWeek.map((w) => ({ x: w.weekStart, pages: w.pages }))}
        series={[{ key: 'pages', label: 'Pages', color }]}
        xFormat={formatShort}
        unit="pages"
      />
    </>
  );
}

function GoalTile({ goal: g, color }: { goal: GoalWithProgress; color: string }) {
  if (g.type === 'consistency') {
    const streak = g.progress.streak ?? 0;
    return (
      <div className="goal-tile">
        <ProgressRing current={g.progress.current} target={g.progress.target} color={color} />
        <div>
          <div className="goal-title">{g.title}</div>
          <div className="goal-sub">
            this {g.period}
            {streak > 0 && ` · 🔥 ${streak}-${g.period} streak`}
          </div>
        </div>
      </div>
    );
  }
  return (
    <div className="goal-tile pace">
      <div className="goal-title">{g.title}</div>
      <PaceBar current={g.progress.current} target={g.progress.target} expected={g.progress.expected} color={color} />
    </div>
  );
}
