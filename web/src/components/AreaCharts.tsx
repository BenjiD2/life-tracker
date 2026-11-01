import { addDays, daysBetween } from '../../../shared/dates';
import { minutesFactor, type SubjectGroup } from '../../../shared/subjects';
import type { DashboardData, Tracker } from '../../../shared/types';
import { formatMonth, formatShort } from '../format';
import { SLOTS, TrendChart, type Series } from './TrendChart';

type Row = Record<string, string | number>;

/** One stacked bar chart, built from dashboard data and drawn by `BarCharts`. */
export interface BarSpec {
  title: string;
  rows: Row[];
  series: Series[];
  unit?: string;
  decimals?: boolean;
}

const ESTIMATED_OPACITY = 0.55;
const hours = (minutes: number) => Math.round(minutes / 6) / 10; // one decimal place
const unitKey = (t: Tracker) => t.unit?.trim().toLowerCase() ?? '';
const capitalise = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);
const hasAny = (spec: BarSpec) => spec.rows.some((r) => spec.series.some((s) => Number(r[s.key]) > 0));

const periodsOf = (data: DashboardData) => data.pagesRead.map((w) => w.periodStart); // every bucket, zero-filled
const totalOf = (data: DashboardData, id: number, x: string) =>
  data.trackerTotals.find((w) => w.trackerId === id && w.periodStart === x)?.total ?? 0;
const minutesOf = (data: DashboardData, id: number, x: string) =>
  data.trackerMinutes.find((w) => w.trackerId === id && w.periodStart === x)?.minutes ?? 0;

/** Archived trackers still chart while they have data in the range. */
export function visibleTrackers(trackers: Tracker[], data: DashboardData): Tracker[] {
  return trackers.filter(
    (t) => !t.archived
      || data.trackerTotals.some((w) => w.trackerId === t.id && w.total > 0)
      || data.mood.some((m) => m.trackerId === t.id),
  );
}

/**
 * One chart per unit (units never share an axis), stacked by tracker, then estimated total time
 * when any tracker is converted with minutes per unit. Charts with nothing logged are dropped.
 */
export function quantityCharts(trackers: Tracker[], data: DashboardData): BarSpec[] {
  const periods = periodsOf(data);
  const byUnit = new Map<string, Tracker[]>();
  for (const t of trackers.filter((t) => t.kind === 'quantity')) byUnit.set(unitKey(t), [...(byUnit.get(unitKey(t)) ?? []), t]);

  const specs: BarSpec[] = [...byUnit.values()].map((group) => {
    const unit = group[0].unit?.trim() || undefined;
    return {
      title: unit ? `${capitalise(unit)} per ${data.bucket}` : `Totals per ${data.bucket}`,
      unit,
      series: group.map((t, i) => ({ key: `t${t.id}`, label: t.name, color: SLOTS[i % SLOTS.length] })),
      rows: periods.map((x) => Object.fromEntries([['x', x], ...group.map((t) => [`t${t.id}`, totalOf(data, t.id, x)])])),
    };
  });

  const timed = trackers.filter((t) => minutesFactor(t) !== null);
  if (timed.some((t) => t.minutesPerUnit !== null)) {
    specs.push({
      title: `Estimated total time per ${data.bucket} (hours)`,
      unit: 'h',
      decimals: true,
      series: timed.map((t, i) => {
        const estimated = t.minutesPerUnit !== null;
        return {
          key: `t${t.id}`,
          label: estimated ? `${t.name} (est.)` : t.name,
          color: SLOTS[i % SLOTS.length],
          opacity: estimated ? ESTIMATED_OPACITY : undefined,
        };
      }),
      rows: periods.map((x) => Object.fromEntries([['x', x], ...timed.map((t) => [`t${t.id}`, hours(minutesOf(data, t.id, x))])])),
    });
  }
  return specs.filter(hasAny);
}

/**
 * Area time stacked by subject, with time-counting trackers outside any subject as a final "No subject"
 * stack so the total is never quietly incomplete. Null unless two or more stacks have time.
 */
export function subjectTimeChart(groups: SubjectGroup<Tracker>[], data: DashboardData): BarSpec | null {
  const ordered = [...groups.filter((g) => g.key !== null), ...groups.filter((g) => g.key === null)]
    .map((g) => ({ label: g.label ?? 'No subject', timed: g.trackers.filter((t) => minutesFactor(t) !== null) }))
    .filter((g) => g.timed.length > 0);
  const series = ordered.map((g, i): Series => ({ key: `s${i}`, label: g.label, color: SLOTS[i % SLOTS.length] }));
  const rows = periodsOf(data).map((x) =>
    Object.fromEntries([['x', x], ...ordered.map((g, i) => [`s${i}`, hours(g.timed.reduce((sum, t) => sum + minutesOf(data, t.id, x), 0))])]),
  );
  const withTime = series.filter((s) => rows.some((r) => Number(r[s.key]) > 0));
  return withTime.length < 2 ? null : { title: `Estimated time by subject per ${data.bucket} (hours)`, unit: 'h', decimals: true, series, rows };
}

export function BarCharts({ specs, data }: { specs: BarSpec[]; data: DashboardData }) {
  return specs.map((s) => (
    <div key={s.title}>
      <div className="chart-title">{s.title}</div>
      <TrendChart kind="bar" data={s.rows} series={s.series} unit={s.unit} decimals={s.decimals}
        xFormat={data.bucket === 'week' ? formatShort : formatMonth} />
    </div>
  ));
}

/** Rating trend line over every day of the range, so spacing on the axis is proportional to time. Null with no ratings logged. */
export function RatingChart({ ratings, data, color }: { ratings: Tracker[]; data: DashboardData; color: string }) {
  const ids = new Set(ratings.map((t) => t.id));
  const mood = data.mood.filter((m) => ids.has(m.trackerId));
  if (mood.length === 0) return null;
  const rows = Array.from({ length: daysBetween(data.from, data.to) + 1 }, (_, i) => addDays(data.from, i)).map((x) => {
    const row: Row = { x };
    for (const m of mood.filter((m) => m.date === x)) row[`t${m.trackerId}`] = m.value;
    return row;
  });
  return (
    <>
      <div className="chart-title">{ratings.length === 1 ? ratings[0].name : 'Ratings'}</div>
      <TrendChart
        kind="line"
        data={rows}
        series={ratings.map((t, i): Series => ({ key: `t${t.id}`, label: t.name, color: ratings.length === 1 ? color : SLOTS[i % SLOTS.length] }))}
        xFormat={formatShort}
        yDomain={[1, 5]}
        yTicks={[1, 2, 3, 4, 5]}
        dots={mood.length <= 60}
      />
    </>
  );
}
