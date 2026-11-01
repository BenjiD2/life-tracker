import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { addDays, daysBetween, isDateStr, todayLocal } from '../../../shared/dates';
import type { Area, DashboardData, DateStr, GoalWithProgress, Tracker } from '../../../shared/types';
import * as api from '../api';
import { Heatmap } from '../components/Heatmap';
import { PaceBar } from '../components/PaceBar';
import { ProgressRing } from '../components/ProgressRing';
import { TrendChart, type Series } from '../components/TrendChart';
import { RangeFilter, presetRange, PRESETS, type RangeKey } from '../components/RangeFilter';
import { formatDay, formatMonth, formatShort } from '../format';

// Categorical slots in fixed order (dataviz reference palette); a series keeps its slot by tracker order, never by rank.
const SLOTS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

/** The selected range lives in the URL (?range=6m, or ?range=custom&from=…&to=…) so a reload keeps it. */
function useRange() {
  const [params, setParams] = useSearchParams();
  const today = todayLocal();
  const key = (params.get('range') ?? '12w') as RangeKey;
  const from = params.get('from') ?? '';
  const to = params.get('to') ?? '';
  const custom = key === 'custom' && isDateStr(from) && isDateStr(to) && from <= to;
  const preset = PRESETS.some((p) => p.key === key) ? (key as Exclude<RangeKey, 'custom'>) : '12w';
  const range = custom ? { from, to } : presetRange(preset, today);
  return {
    today,
    key: custom ? 'custom' : preset,
    range,
    setPreset: (k: Exclude<RangeKey, 'custom'>) => setParams({ range: k }),
    setCustom: (f: DateStr, t: DateStr) => setParams({ range: 'custom', from: f, to: t }),
  } as const;
}

export function Dashboard() {
  const { today, key, range, setPreset, setCustom } = useRange();
  const [data, setData] = useState<DashboardData | null>(null);
  const [trackers, setTrackers] = useState<Tracker[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => { api.getTrackers().then(setTrackers).catch(() => {}); }, []);
  useEffect(() => {
    let live = true;
    api.getDashboard(range)
      .then((d) => { if (live) { setData(d); setError(null); } })
      .catch((e) => live && setError(api.errorMessage(e)));
    return () => { live = false; };
  }, [range.from, range.to]);

  const filter = (
    <RangeFilter range={key} from={range.from} to={range.to} today={today} onPreset={setPreset} onCustom={setCustom} />
  );
  if (error) return <>{filter}<div className="banner-error">{error}</div></>;
  if (!data) return <>{filter}<p className="muted">Loading…</p></>;

  const hasReadingArea = data.areas.some((a) => a.area.name.toLowerCase() === 'reading');
  return (
    <div className="dash-grid">
      <div>
        {filter}
        <p className="range-note">
          {formatDay(data.from)} – {formatDay(data.to)} · {data.bucket === 'week' ? 'weekly' : 'monthly'} totals · goals show current progress
        </p>
      </div>
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
      {!hasReadingArea && data.pagesRead.some((w) => w.pages > 0) && (
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
    (t) => t.kind === 'quantity' && (!t.archived || data.trackerTotals.some((w) => w.trackerId === t.id && w.total > 0)),
  );
  const periods = [...new Set(data.trackerTotals.map((w) => w.periodStart))];
  const weeklyRows = periods.map((x) => {
    const row: Record<string, string | number> = { x };
    for (const t of quantity) row[`t${t.id}`] = data.trackerTotals.find((w) => w.trackerId === t.id && w.periodStart === x)?.total ?? 0;
    return row;
  });
  const anyMinutes = weeklyRows.some((r) => quantity.some((t) => Number(r[`t${t.id}`]) > 0));
  const units = [...new Set(quantity.map((t) => t.unit ?? ''))];

  const ratings = trackers.filter((t) => t.kind === 'rating');
  const mood = data.mood.filter((m) => ids.has(m.trackerId));
  // Every day of the 90-day window is a category, so spacing on the axis is proportional to time.
  const moodRows = Array.from({ length: daysBetween(data.from, data.to) + 1 }, (_, i) => addDays(data.from, i)).map((x) => {
    const row: Record<string, string | number> = { x };
    for (const m of mood.filter((m) => m.date === x)) row[`t${m.trackerId}`] = m.value;
    return row;
  });

  return (
    <section className="card area-card" style={{ borderLeftColor: area.color }}>
      <div className="dash-head">
        <span className="swatch" style={{ background: area.color }} />
        <h2>{area.name}</h2>
        <span className="muted" style={{ fontSize: '0.85rem' }}>{activeDates.length} active days</span>
      </div>
      <Heatmap dates={activeDates} start={data.from} end={data.to} color={area.color} />

      {goals.length > 0 && (
        <div className="goal-tiles">{goals.map((g) => <GoalTile key={g.id} goal={g} color={area.color} />)}</div>
      )}

      {quantity.length > 0 && anyMinutes && (
        <>
          <div className="chart-title">{data.bucket === 'week' ? 'Weekly' : 'Monthly'} totals{units.length === 1 && units[0] ? ` (${units[0]})` : ''}</div>
          <TrendChart
            kind="bar"
            data={weeklyRows}
            series={quantity.map((t, i): Series => ({ key: `t${t.id}`, label: t.name, color: SLOTS[i % SLOTS.length] }))}
            xFormat={data.bucket === 'week' ? formatShort : formatMonth}
            unit={units.length === 1 ? units[0] : undefined}
          />
        </>
      )}

      {ratings.length > 0 && mood.length > 0 && (
        <>
          <div className="chart-title">{ratings.length === 1 ? ratings[0].name : 'Ratings'}</div>
          <TrendChart
            kind="line"
            data={moodRows}
            series={ratings.map((t, i): Series => ({ key: `t${t.id}`, label: t.name, color: ratings.length === 1 ? area.color : SLOTS[i % SLOTS.length] }))}
            xFormat={formatShort}
            yDomain={[1, 5]}
            yTicks={[1, 2, 3, 4, 5]}
            dots={mood.length <= 60}
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
      <div className="chart-title">Pages read per {data.bucket}</div>
      <TrendChart
        kind="bar"
        data={data.pagesRead.map((w) => ({ x: w.periodStart, pages: w.pages }))}
        series={[{ key: 'pages', label: 'Pages', color }]}
        xFormat={data.bucket === 'week' ? formatShort : formatMonth}
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
