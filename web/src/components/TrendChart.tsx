import {
  Bar, BarChart, CartesianGrid, Legend, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts';

// Categorical slots in fixed order (dataviz reference palette); a series keeps its slot by position, never by rank.
export const SLOTS = ['var(--series-1)', 'var(--series-2)', 'var(--series-3)', 'var(--series-4)'];

const CHART_HEIGHT = 180;

export interface Series {
  key: string;
  label: string;
  color: string;
  /** Bar fill opacity; lighter marks an estimated series. */
  opacity?: number;
}

/**
 * Thin Recharts wrapper: one x axis, one y axis, recessive grid, hover tooltip.
 * `bar` stacks every series; `line` draws each as a 2px line with 8px dots.
 * By default a legend appears only with two or more series (a single series is named by the chart title).
 */
export function TrendChart({
  data, series, kind, xFormat, yDomain, yTicks, unit, dots = true, decimals = false, legend = series.length > 1,
}: {
  data: Record<string, string | number>[];
  series: Series[];
  kind: 'line' | 'bar';
  xFormat?: (x: string) => string;
  yDomain?: [number, number];
  yTicks?: number[];
  unit?: string;
  /** Line charts: draw a dot per point. Off for dense ranges, where dots pile into clutter. */
  dots?: boolean;
  /** Allow fractional y ticks (e.g. hours). */
  decimals?: boolean;
  legend?: boolean;
}) {
  const axis = { stroke: 'var(--axis)', tick: { fill: 'var(--ink-muted)', fontSize: 11 }, tickLine: false };
  const common = (
    <>
      <CartesianGrid vertical={false} stroke="var(--grid)" />
      <XAxis dataKey="x" {...axis} tickFormatter={xFormat} minTickGap={16} />
      <YAxis {...axis} axisLine={false} width={decimals ? 48 : 36} domain={yDomain} ticks={yTicks} allowDecimals={decimals} />
      <Tooltip
        cursor={kind === 'bar' ? { fill: 'var(--cell-empty)', opacity: 0.6 } : { stroke: 'var(--axis)' }}
        content={({ active, payload, label }) =>
          active && payload?.length ? (
            <div className="chart-tooltip">
              <div style={{ fontWeight: 600, marginBottom: 2 }}>{xFormat ? xFormat(String(label)) : label}</div>
              {payload.filter((p) => p.value !== undefined && p.value !== null).map((p) => (
                <div key={String(p.dataKey)} className="row">
                  <span className="swatch" style={{ background: p.color }} />
                  <span>{series.find((s) => s.key === p.dataKey)?.label}</span>
                  <span style={{ marginLeft: 'auto', fontVariantNumeric: 'tabular-nums' }}>{p.value}{unit ? ` ${unit}` : ''}</span>
                </div>
              ))}
            </div>
          ) : null
        }
      />
      {legend && <Legend iconType="square" iconSize={10} wrapperStyle={{ fontSize: 12 }}
        // Legend text stays in ink; the swatch alone carries the series color.
        formatter={(value) => <span style={{ color: 'var(--muted)' }}>{value}</span>} />}
    </>
  );

  return (
    <ResponsiveContainer width="100%" height={CHART_HEIGHT}>
      {kind === 'bar' ? (
        <BarChart data={data} barCategoryGap="25%">
          {common}
          {series.map((s, i) => (
            <Bar key={s.key} dataKey={s.key} name={s.label} stackId="a" fill={s.color} fillOpacity={s.opacity}
              // 2px surface gap between stacked segments; only the top segment gets rounded ends.
              stroke="var(--surface)" strokeWidth={2}
              radius={i === series.length - 1 ? [4, 4, 0, 0] : 0} isAnimationActive={false} />
          ))}
        </BarChart>
      ) : (
        <LineChart data={data}>
          {common}
          {series.map((s) => (
            <Line key={s.key} dataKey={s.key} name={s.label} stroke={s.color} strokeWidth={2}
              dot={dots && { r: 4, fill: s.color, stroke: 'var(--surface)', strokeWidth: 2 }} activeDot={{ r: 5 }}
              connectNulls isAnimationActive={false} />
          ))}
        </LineChart>
      )}
    </ResponsiveContainer>
  );
}
