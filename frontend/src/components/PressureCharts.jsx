import { useMemo } from 'react';
import {
  Bar,
  BarChart,
  CartesianGrid,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Activity, ChevronDown, ChevronUp } from 'lucide-react';
import { EmptyState } from '../ui/index.js';
import { getTokenValue, useTheme } from '../ui/useTheme.js';
import { number } from '../lib/format.js';
import '../styles/ops/charts_roi.css';

const FONT_MONO = 'IBM Plex Mono, monospace';

export default function PressureCharts({ result, open, onToggle }) {
  const { theme } = useTheme();

  // Recharts needs concrete colours; re-read tokens whenever the theme changes.
  const colors = useMemo(
    () => ({
      grid: getTokenValue('--line'),
      axis: getTokenValue('--line-strong'),
      tick: getTokenValue('--ink-muted'),
      baseline: getTokenValue('--ink-faint'),
      observed: getTokenValue('--water'),
      drop: getTokenValue('--valve'),
      surface: getTokenValue('--surface-raised'),
      ink: getTokenValue('--ink'),
    }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [theme],
  );

  const data = useMemo(
    () =>
      (result?.sensor_readings || []).map((d, i) => ({
        ...d,
        label: `S${i + 1}`,
      })),
    [result],
  );

  const tick = { fill: colors.tick, fontSize: 12, fontFamily: FONT_MONO };
  const tooltipStyle = {
    background: colors.surface,
    border: `1px solid ${colors.axis}`,
    borderRadius: 6,
    color: colors.ink,
    fontSize: 12,
    fontFamily: FONT_MONO,
  };

  return (
    <section
      className={`charts-drawer ${open ? 'expanded' : 'collapsed'}`}
      aria-label="Sensor readings"
    >
      <button
        type="button"
        className="drawer-handle"
        onClick={onToggle}
        aria-expanded={Boolean(open)}
      >
        <span className="handle-grip" aria-hidden="true" />
        <b>Sensor readings</b>
        <span className="drawer-result">
          {result ? 'Latest simulation' : 'Awaiting simulation'}
        </span>
        <span className="drawer-chevron" aria-hidden="true">
          {open ? <ChevronDown size={16} /> : <ChevronUp size={16} />}
        </span>
      </button>
      {open && (
        <div className="charts-body">
          {data.length === 0 ? (
            <div className="charts-empty">
              <EmptyState
                icon={Activity}
                title="No readings yet"
                body="Sensor readings appear after a simulation."
              />
            </div>
          ) : (
            <>
              <div className="chart-block">
                <div className="chart-heading">
                  <span>Pressure</span>
                  <small>
                    Baseline vs observed <i>m</i>
                  </small>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data}
                    margin={{ top: 18, right: 12, left: 0, bottom: 0 }}
                    barGap={3}
                  >
                    <CartesianGrid
                      stroke={colors.grid}
                      strokeDasharray="3 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={tick}
                      axisLine={{ stroke: colors.axis }}
                      tickLine={false}
                    />
                    <YAxis
                      domain={[0, 'auto']}
                      tick={tick}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      label={{
                        value: 'm',
                        angle: -90,
                        position: 'insideLeft',
                        fill: colors.tick,
                        fontSize: 12,
                        fontFamily: FONT_MONO,
                      }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: colors.grid, fillOpacity: 0.4 }}
                    />
                    <Bar
                      dataKey="baseline_m"
                      name="Baseline"
                      fill={colors.baseline}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                    <Bar
                      dataKey="observed_m"
                      name="Observed"
                      fill={colors.observed}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    >
                      <LabelList
                        dataKey="drop_m"
                        position="top"
                        formatter={(value) => `−${number(value, 1)}`}
                        fill={colors.drop}
                        fontSize={12}
                        fontFamily={FONT_MONO}
                      />
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
              <div className="signature-block">
                <div className="chart-heading">
                  <span>Drop</span>
                  <small>
                    Pressure drop <i>Δm</i>
                  </small>
                </div>
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart
                    data={data}
                    margin={{ top: 16, right: 8, left: 0, bottom: 0 }}
                  >
                    <CartesianGrid
                      stroke={colors.grid}
                      strokeDasharray="3 5"
                      vertical={false}
                    />
                    <XAxis
                      dataKey="label"
                      tick={tick}
                      axisLine={false}
                      tickLine={false}
                    />
                    <YAxis
                      tick={tick}
                      axisLine={false}
                      tickLine={false}
                      width={36}
                      label={{
                        value: 'Δm',
                        angle: -90,
                        position: 'insideLeft',
                        fill: colors.tick,
                        fontSize: 12,
                        fontFamily: FONT_MONO,
                      }}
                    />
                    <Tooltip
                      contentStyle={tooltipStyle}
                      cursor={{ fill: colors.grid, fillOpacity: 0.4 }}
                    />
                    <Bar
                      dataKey="drop_m"
                      name="Pressure drop"
                      fill={colors.drop}
                      radius={[3, 3, 0, 0]}
                      maxBarSize={24}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </>
          )}
        </div>
      )}
    </section>
  );
}
