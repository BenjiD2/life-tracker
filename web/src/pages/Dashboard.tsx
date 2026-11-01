import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { isBooksArea } from '../../../shared/books-area';
import { isDateStr, todayLocal } from '../../../shared/dates';
import { groupBySubject } from '../../../shared/subjects';
import type { Area, DashboardData, DateStr, GoalWithProgress, Tracker } from '../../../shared/types';
import * as api from '../api';
import { Heatmap } from '../components/Heatmap';
import { PaceBar } from '../components/PaceBar';
import { ProgressRing } from '../components/ProgressRing';
import { TrendChart } from '../components/TrendChart';
import { BarCharts, quantityCharts, RatingChart, subjectTimeChart, visibleTrackers } from '../components/AreaCharts';
import { RangeFilter, presetRange, PRESETS, type RangeKey } from '../components/RangeFilter';
import { formatDay, formatMonth, formatShort } from '../format';

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
  const [error, setError] = useState<string | null>(null);

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

  const hasReadingArea = data.areas.some((a) => isBooksArea(a.area));
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
          trackers={data.trackers.filter((t) => t.areaId === area.id)}
          showPages={isBooksArea(area)}
        />
      ))}
      {!hasReadingArea && data.pagesRead.some((w) => w.pages > 0) && (
        <section className="card"><PagesChart data={data} color="var(--series-1)" /></section>
      )}
    </div>
  );
}

function AreaCard({ area, activeDates, data, trackers, showPages }: {
  area: Area; activeDates: DateStr[]; data: DashboardData; trackers: Tracker[]; showPages: boolean;
}) {
  const goals = data.goals.filter((g) => g.areaId === area.id);
  const groups = groupBySubject(visibleTrackers(trackers, data), trackers);
  const ungrouped = groups.find((g) => g.key === null)?.trackers ?? [];
  const subjects = groups.filter((g) => g.key !== null);
  const bySubject = subjects.length > 0 ? subjectTimeChart(groups, data) : null;

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

      {bySubject && <BarCharts specs={[bySubject]} data={data} />}
      <BarCharts specs={quantityCharts(ungrouped, data)} data={data} />
      <RatingChart ratings={ungrouped.filter((t) => t.kind === 'rating')} data={data} color={area.color} />

      {subjects.map((g) => <SubjectSection key={g.key} label={g.label!} trackers={g.trackers} data={data} color={area.color} />)}

      {showPages && <PagesChart data={data} color={area.color} />}
    </section>
  );
}

function SubjectSection({ label, trackers, data, color }: { label: string; trackers: Tracker[]; data: DashboardData; color: string }) {
  const specs = quantityCharts(trackers, data);
  const ratings = trackers.filter((t) => t.kind === 'rating');
  const anyRating = data.mood.some((m) => ratings.some((t) => t.id === m.trackerId));
  // Check trackers have no chart of their own, so name their days here rather than call the section empty.
  const checks = trackers.flatMap((t) => {
    const days = data.checkDays.find((c) => c.trackerId === t.id)?.days;
    return days === undefined ? [] : [`${t.name}: ${days} ${days === 1 ? 'day' : 'days'}`];
  });
  return (
    <div className="subject-section">
      <h3>{label}</h3>
      {specs.length === 0 && !anyRating && checks.length === 0 && <p className="muted">Nothing logged in this range.</p>}
      {checks.length > 0 && <p className="muted">{checks.join(' · ')}</p>}
      <BarCharts specs={specs} data={data} />
      <RatingChart ratings={ratings} data={data} color={color} />
    </div>
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
