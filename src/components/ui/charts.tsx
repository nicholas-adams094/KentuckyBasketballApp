/**
 * Charts, hand-built in SVG.
 *
 * No charting library: these are simple, fully themeable, print correctly, and add
 * nothing to the bundle. Each chart is responsive via `viewBox` + `preserveAspectRatio`
 * and carries a text alternative, because a chart that a screen reader cannot describe
 * is not accessible data.
 */

import { useId, type ReactNode } from 'react';

// ---------------------------------------------------------------------------
// Shared helpers
// ---------------------------------------------------------------------------

/** Series colours, in assignment order. Distinguishable in both themes. */
export const SERIES_COLORS = ['#1a5cf0', '#f3b93f', '#16a37b', '#d2554f'] as const;

function niceMax(value: number, step = 5): number {
  if (value <= 0) return step;
  return Math.ceil(value / step) * step;
}

interface ChartFrameProps {
  title: string;
  description: string;
  width: number;
  height: number;
  children: ReactNode;
  className?: string;
}

function ChartFrame({ title, description, width, height, children, className }: ChartFrameProps) {
  const titleId = useId();
  const descId = useId();
  return (
    <svg
      className={`chart ${className ?? ''}`}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMidYMid meet"
      role="img"
      aria-labelledby={`${titleId} ${descId}`}
    >
      <title id={titleId}>{title}</title>
      <desc id={descId}>{description}</desc>
      {children}
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Line chart — used for season trends and career arcs
// ---------------------------------------------------------------------------

export interface LineSeries {
  label: string;
  color?: string;
  points: { x: number; y: number }[];
}

export interface LineChartProps {
  series: LineSeries[];
  xLabels: string[];
  title: string;
  description: string;
  height?: number;
  yLabel?: string;
  /** Draw a zero baseline (used for +/- differentials). */
  zeroLine?: boolean;
}

export function LineChart({
  series,
  xLabels,
  title,
  description,
  height = 220,
  yLabel,
  zeroLine = false,
}: LineChartProps) {
  const width = 640;
  const pad = { top: 16, right: 16, bottom: 30, left: 40 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;

  const allY = series.flatMap((s) => s.points.map((p) => p.y));
  const allX = series.flatMap((s) => s.points.map((p) => p.x));
  const maxY = allY.length ? niceMax(Math.max(...allY, 0), 5) : 5;
  const minY = zeroLine ? Math.min(0, Math.floor(Math.min(...allY, 0) / 5) * 5) : 0;
  const maxX = allX.length ? Math.max(...allX) : 1;
  const minX = allX.length ? Math.min(...allX) : 0;

  const sx = (x: number) => pad.left + (maxX === minX ? plotW / 2 : ((x - minX) / (maxX - minX)) * plotW);
  const sy = (y: number) => pad.top + plotH - ((y - minY) / (maxY - minY || 1)) * plotH;

  const ticks = 4;
  const gridValues = Array.from({ length: ticks + 1 }, (_, i) => minY + ((maxY - minY) / ticks) * i);

  return (
    <ChartFrame title={title} description={description} width={width} height={height}>
      <g className="chart__grid">
        {gridValues.map((value) => (
          <g key={value}>
            <line x1={pad.left} y1={sy(value)} x2={width - pad.right} y2={sy(value)} />
            <text x={pad.left - 8} y={sy(value) + 3} textAnchor="end">
              {Number.isInteger(value) ? value : value.toFixed(1)}
            </text>
          </g>
        ))}
      </g>

      {zeroLine && minY < 0 && (
        <line
          x1={pad.left}
          y1={sy(0)}
          x2={width - pad.right}
          y2={sy(0)}
          className="chart__axis"
          strokeDasharray="3 3"
        />
      )}

      {xLabels.map((label, index) => {
        const x = sx(minX + ((maxX - minX) / Math.max(1, xLabels.length - 1)) * index);
        return (
          <text key={label} x={x} y={height - 8} textAnchor="middle">
            {label}
          </text>
        );
      })}

      {yLabel && (
        <text x={pad.left - 8} y={pad.top - 4} textAnchor="end" fontWeight="700">
          {yLabel}
        </text>
      )}

      {series.map((s, seriesIndex) => {
        const color = s.color ?? SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
        const path = s.points.map((p, i) => `${i === 0 ? 'M' : 'L'}${sx(p.x)},${sy(p.y)}`).join(' ');
        return (
          <g key={s.label}>
            <path d={path} className="chart__series-line" stroke={color} />
            {s.points.map((p) => (
              <circle key={`${p.x}-${p.y}`} cx={sx(p.x)} cy={sy(p.y)} r={3.5} className="chart__point" stroke={color}>
                <title>{`${s.label}: ${p.y}`}</title>
              </circle>
            ))}
          </g>
        );
      })}
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Margin bar chart — one bar per game, win above the axis, loss below
// ---------------------------------------------------------------------------

export interface MarginBarsProps {
  values: { margin: number; label: string; result: 'W' | 'L' }[];
  title: string;
  description: string;
  height?: number;
  onSelect?: (index: number) => void;
}

export function MarginBars({ values, title, description, height = 160, onSelect }: MarginBarsProps) {
  const width = 640;
  const pad = { top: 12, right: 8, bottom: 12, left: 30 };
  const plotW = width - pad.left - pad.right;
  const plotH = height - pad.top - pad.bottom;
  const mid = pad.top + plotH / 2;
  const maxAbs = Math.max(10, ...values.map((v) => Math.abs(v.margin)));
  const barW = values.length ? Math.max(1.5, plotW / values.length - 1.5) : 2;

  return (
    <ChartFrame title={title} description={description} width={width} height={height}>
      <line x1={pad.left} y1={mid} x2={width - pad.right} y2={mid} className="chart__axis" />
      <text x={pad.left - 6} y={pad.top + 8} textAnchor="end">
        +{maxAbs}
      </text>
      <text x={pad.left - 6} y={height - pad.bottom} textAnchor="end">
        −{maxAbs}
      </text>

      {values.map((value, index) => {
        const h = (Math.abs(value.margin) / maxAbs) * (plotH / 2);
        const x = pad.left + (plotW / Math.max(1, values.length)) * index;
        const y = value.margin >= 0 ? mid - h : mid;
        return (
          <rect
            key={`${value.label}-${index}`}
            x={x}
            y={y}
            width={barW}
            height={Math.max(1, h)}
            rx={1}
            className={`chart__bar chart__bar--${value.result === 'W' ? 'win' : 'loss'}`}
            style={onSelect ? { cursor: 'pointer' } : undefined}
            onClick={onSelect ? () => onSelect(index) : undefined}
          >
            <title>{value.label}</title>
          </rect>
        );
      })}
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Radar chart — player comparison across the box-score categories
// ---------------------------------------------------------------------------

export interface RadarSeries {
  label: string;
  color?: string;
  /** Values already normalised to 0–1. */
  values: number[];
}

export interface RadarChartProps {
  axes: string[];
  series: RadarSeries[];
  title: string;
  description: string;
  size?: number;
}

export function RadarChart({ axes, series, title, description, size = 320 }: RadarChartProps) {
  const cx = size / 2;
  const cy = size / 2;
  const radius = size / 2 - 40;
  const count = axes.length;

  const pointAt = (index: number, value: number) => {
    // Start at 12 o'clock and go clockwise.
    const angle = (Math.PI * 2 * index) / count - Math.PI / 2;
    return {
      x: cx + Math.cos(angle) * radius * value,
      y: cy + Math.sin(angle) * radius * value,
    };
  };

  const rings = [0.25, 0.5, 0.75, 1];

  return (
    <ChartFrame title={title} description={description} width={size} height={size}>
      <g className="chart__grid">
        {rings.map((ring) => (
          <polygon
            key={ring}
            points={axes
              .map((_, index) => {
                const p = pointAt(index, ring);
                return `${p.x},${p.y}`;
              })
              .join(' ')}
            fill="none"
            stroke="var(--chart-grid)"
          />
        ))}
        {axes.map((_, index) => {
          const p = pointAt(index, 1);
          return <line key={index} x1={cx} y1={cy} x2={p.x} y2={p.y} />;
        })}
      </g>

      {axes.map((axis, index) => {
        const p = pointAt(index, 1.17);
        return (
          <text
            key={axis}
            x={p.x}
            y={p.y}
            textAnchor={p.x > cx + 4 ? 'start' : p.x < cx - 4 ? 'end' : 'middle'}
            dominantBaseline="middle"
            fontWeight="700"
          >
            {axis}
          </text>
        );
      })}

      {series.map((s, seriesIndex) => {
        const color = s.color ?? SERIES_COLORS[seriesIndex % SERIES_COLORS.length];
        const points = s.values
          .map((value, index) => {
            const p = pointAt(index, Math.max(0.02, Math.min(1, value)));
            return `${p.x},${p.y}`;
          })
          .join(' ');
        return (
          <g key={s.label}>
            <polygon points={points} fill={color} fillOpacity={0.14} stroke={color} strokeWidth={2} />
            {s.values.map((value, index) => {
              const p = pointAt(index, Math.max(0.02, Math.min(1, value)));
              return <circle key={index} cx={p.x} cy={p.y} r={3} fill={color} />;
            })}
          </g>
        );
      })}
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Sparkline — inline trend for a single player or season
// ---------------------------------------------------------------------------

export interface SparklineProps {
  values: number[];
  title: string;
  width?: number;
  height?: number;
  color?: string;
}

export function Sparkline({ values, title, width = 90, height = 26, color }: SparklineProps) {
  if (values.length === 0) return null;
  const max = Math.max(...values, 0.1);
  const min = Math.min(...values, 0);
  const step = values.length > 1 ? width / (values.length - 1) : width;
  const y = (value: number) => height - 2 - ((value - min) / (max - min || 1)) * (height - 4);
  const path = values.map((value, index) => `${index === 0 ? 'M' : 'L'}${index * step},${y(value)}`).join(' ');
  const stroke = color ?? 'var(--accent)';

  return (
    <ChartFrame title={title} description={`Trend from ${values[0]} to ${values[values.length - 1]}`} width={width} height={height}>
      <path d={`${path} L${width},${height} L0,${height} Z`} fill={stroke} opacity={0.12} />
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.6} strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={(values.length - 1) * step} cy={y(values[values.length - 1])} r={2.2} fill={stroke} />
    </ChartFrame>
  );
}

// ---------------------------------------------------------------------------
// Meter — a labelled horizontal bar
// ---------------------------------------------------------------------------

export interface MeterProps {
  label: string;
  /** 0–1. */
  fraction: number;
  display: string;
}

export function Meter({ label, fraction, display }: MeterProps) {
  const pct = Math.max(2, Math.min(100, fraction * 100));
  return (
    <div className="meter">
      <span className="meter__label">{label}</span>
      <div
        className="meter__track"
        role="meter"
        aria-valuenow={Math.round(fraction * 100)}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label={`${label}: ${display}`}
      >
        <div className="meter__fill" style={{ width: `${pct}%` }} />
      </div>
      <b className="meter__value">{display}</b>
    </div>
  );
}
