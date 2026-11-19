"use client";

import { useId } from "react";
import {
  Area,
  AreaChart,
  ReferenceArea,
  ReferenceDot,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
  type DotProps,
} from "recharts";
import { fmtDay, fmtDayShort, fmtMonth, fmtPeriod, fmtYear, formatAxis, formatValue, type ValueFormat } from "@/lib/format";
import type { Frequency, Point } from "@/lib/series";
import { useReducedMotion } from "../motion";

type Row = { t: number; date: string; value: number | null; bridge?: number | null };

const DAY = 86_400_000;

const toRow = (p: Point): Row => ({ t: Date.parse(`${p.date}T00:00:00Z`), date: p.date, value: p.value });

/**
 * Insert a null row where otherwise-frequent data has a long hole, so the solid
 * line breaks instead of pretending there was data. The two points either side
 * of the hole also get a `bridge` value, drawn as a faint dashed line, so the
 * reading after the hole doesn't float on its own.
 */
function breakGaps(rows: Row[]): Row[] {
  const out: Row[] = rows.map((r) => ({ ...r, bridge: null }));
  const res: Row[] = [];
  out.forEach((r, i) => {
    const prev = out[i - 1];
    const prevPrev = out[i - 2];
    if (prev && prevPrev && r.t - prev.t > 45 * DAY && prev.t - prevPrev.t <= 10 * DAY) {
      prev.bridge = prev.value;
      r.bridge = r.value;
      res.push({ t: prev.t + DAY, date: "", value: null, bridge: null });
    }
    res.push(r);
  });
  return res;
}

/** Evenly spaced y ticks on a "nice" step (1, 2, 2.5 or 5 × 10ⁿ). */
function niceScale(min: number, max: number, target: number): { ticks: number[]; domain: [number, number] } {
  if (min === max) {
    const pad = Math.abs(min) * 0.05 || 1;
    return { ticks: [min], domain: [min - pad, max + pad] };
  }
  const raw = (max - min) / (target - 1);
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
  const lo = Math.floor(min / step) * step;
  const hi = Math.ceil(max / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(12)));
  return { ticks, domain: [lo, hi] };
}

function timeTicks(rows: Row[], count: number): number[] {
  if (rows.length === 0) return [];
  const first = rows[0].t;
  const last = rows[rows.length - 1].t;
  if (count <= 1 || first === last) return [first];
  const step = (last - first) / (count - 1);
  return Array.from({ length: count }, (_, i) => Math.round(first + step * i));
}

function tickLabel(t: number, spanDays: number): string {
  const iso = new Date(t).toISOString().slice(0, 10);
  if (spanDays <= 120) return fmtDayShort(iso);
  if (spanDays <= 900) return fmtMonth(iso);
  return fmtYear(iso);
}

/** Hover dot: solid core in the line colour with a soft halo. */
function GlowDot({ cx, cy, color }: DotProps & { color: string }) {
  if (cx === undefined || cy === undefined) return null;
  return (
    <g>
      <circle cx={cx} cy={cy} r={10} fill={color} opacity={0.15} />
      <circle cx={cx} cy={cy} r={4.5} fill={color} stroke="var(--color-card)" strokeWidth={2} />
    </g>
  );
}

/** A small value tag beside a marker, e.g. the latest value or the series high. */
function Tag({
  cx,
  cy,
  text,
  tone,
  place,
}: {
  cx?: number;
  cy?: number;
  text: string;
  tone: "solid" | "soft";
  place: "above" | "below" | "left" | "right" | "above-left" | "below-left" | "above-right" | "below-right";
}) {
  if (cx === undefined || cy === undefined) return null;
  const w = text.length * 7 + 16;
  const h = 22;
  const x =
    place === "left" ? cx - w - 12 : place === "right" ? cx + 12 : place.endsWith("-left") ? cx - w + 8 : place.endsWith("-right") ? cx - 8 : cx - w / 2;
  const y = place.startsWith("above") ? cy - h - 12 : place.startsWith("below") ? cy + 12 : cy - h / 2;
  return (
    <g pointerEvents="none">
      <rect
        x={x}
        y={y}
        width={w}
        height={h}
        rx={h / 2}
        fill={tone === "solid" ? "var(--color-primary-solid)" : "var(--color-card)"}
        stroke={tone === "solid" ? "none" : "var(--color-line)"}
      />
      <text
        x={x + w / 2}
        y={y + h / 2 + 4}
        textAnchor="middle"
        fontSize={12}
        fontWeight={500}
        fill={tone === "solid" ? "var(--color-on-primary-solid)" : "var(--color-muted)"}
        style={{ fontVariantNumeric: "tabular-nums" }}
      >
        {text}
      </text>
    </g>
  );
}

export type TimeChartProps = {
  points: Point[];
  format: ValueFormat;
  frequency: Frequency;
  /** "step" holds each value until the next one (policy rates). */
  shape?: "smooth" | "step";
  /** Draw a filled area below the line. */
  fill?: boolean;
  /** Small card version. */
  compact?: boolean;
  height?: number;
  xTickCount?: number;
  /** Override the last x tick label (e.g. "Now"). */
  lastTickLabel?: string;
  /** Shaded horizontal band, e.g. the RBA's 2–3% inflation target. */
  band?: { from: number; to: number; label: string };
  /** Draw a dashed line at zero when the data crosses it. */
  zeroLine?: boolean;
  /** Reports the hovered point (or null when the pointer leaves). Hides the tooltip box. */
  onHover?: (point: Point | null) => void;
  /** A point to pin on the chart (e.g. the low or high from the summary). */
  focus?: Point | null;
  /** Line colour (default: the data blue). */
  color?: string;
  /** Hide both axes for a minimal sparkline. */
  bare?: boolean;
  /** Flat, even area tint instead of the fading fill. */
  flat?: boolean;
  /** Tag the latest value and the high and low of the range. */
  markers?: boolean;
};

export function TimeChart({
  points,
  format,
  frequency,
  shape = "smooth",
  fill = false,
  compact = false,
  height = 160,
  xTickCount = 3,
  lastTickLabel,
  band,
  zeroLine = false,
  onHover,
  focus,
  color = "var(--color-bright)",
  bare = false,
  flat = false,
  markers = false,
}: TimeChartProps) {
  const reduced = useReducedMotion();
  const gradientId = useId();
  const rows = breakGaps(points.map(toRow));
  const hasGap = rows.some((r) => r.bridge != null);

  if (points.length < 2) {
    return (
      <div style={{ height }} className="grid place-items-center text-xs text-faint">
        Not enough data for this period
      </div>
    );
  }

  const values = points.map((p) => p.value);
  const { ticks: yTicks, domain: yDomain } = niceScale(Math.min(...values), Math.max(...values), compact ? 4 : 5);
  const xTicks = timeTicks(rows, xTickCount);
  const spanDays = (rows[rows.length - 1].t - rows[0].t) / DAY;
  const axisStyle = { fill: "var(--color-faint)", fontSize: compact ? 10 : 11 };
  const crossesZero = zeroLine && yDomain[0] < 0 && yDomain[1] > 0;
  const tAt = (p: Point) => Date.parse(`${p.date}T00:00:00Z`);
  const last = points[points.length - 1];
  const high = points.reduce((a, b) => (b.value > a.value ? b : a));
  const low = points.reduce((a, b) => (b.value < a.value ? b : a));
  const firstT = rows[0].t;
  const lastT = rows[rows.length - 1].t;
  // Keep extreme tags off the latest tag and away from the chart edges.
  const nearEnd = (p: Point) => (lastT - tAt(p)) / (lastT - firstT || 1) < 0.15;
  const showHigh = markers && high !== last && !nearEnd(high);
  const showLow = markers && low !== last && !nearEnd(low) && low.value !== high.value;
  const nearStart = (p: Point) => (tAt(p) - firstT) / (lastT - firstT || 1) < 0.08;
  // Share of the y range above the latest value: too little room means the tag goes below it.
  const yRange = yDomain[1] - yDomain[0] || 1;
  const roomAbove = (yDomain[1] - last.value) / yRange;
  const roomBelow = (last.value - yDomain[0]) / yRange;
  // Nothing on the chart sits above the high or below the low, so their tags go
  // above / below the dot when there's room, else beside it.
  const highPlace = (yDomain[1] - high.value) / yRange > 0.14 ? (nearStart(high) ? "above-right" : "above") : nearStart(high) ? "right" : "left";
  const lowPlace = (low.value - yDomain[0]) / yRange > 0.12 ? (nearStart(low) ? "below-right" : "below") : nearStart(low) ? "right" : "left";
  // After a gap the dashed bridge comes in from the upper or lower left; keep the latest tag off it.
  const lastPlace = hasGap ? (roomBelow > 0.15 ? "below-left" : "above-left") : roomAbove > 0.15 ? "above-left" : "below-left";

  return (
    <div style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart
          data={rows}
          margin={bare ? { top: 6, right: 6, bottom: 6, left: 6 } : { top: 10, right: 10, bottom: 0, left: 0 }}
          onMouseMove={(state) => {
            if (!onHover) return;
            const i = Number(state.activeTooltipIndex);
            const row = Number.isFinite(i) ? rows[i] : undefined;
            onHover(row && row.value !== null ? { date: row.date, value: row.value } : null);
          }}
          onMouseLeave={() => onHover?.(null)}
        >
          <defs>
            <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={color} style={{ stopOpacity: compact || band ? 0.16 : "var(--area-top)" }} />
              <stop offset="100%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>

          {!compact &&
            yTicks.map((y) => (
              <ReferenceLine
                key={y}
                y={y}
                stroke={flat ? "var(--color-soft)" : "var(--color-line)"}
                strokeOpacity={flat ? 0.7 : 1}
                strokeDasharray={flat ? "2 4" : undefined}
                ifOverflow="hidden"
              />
            ))}
          {band && (
            <ReferenceArea
              y1={band.from}
              y2={band.to}
              fill="var(--color-good-mark)"
              fillOpacity={0.08}
              stroke="var(--color-good-mark)"
              strokeOpacity={0.7}
              strokeDasharray="3 4"
              ifOverflow="hidden"
            />
          )}
          {crossesZero && <ReferenceLine y={0} stroke="var(--color-faint)" strokeDasharray="4 4" />}

          <XAxis
            dataKey="t"
            type="number"
            scale="time"
            domain={["dataMin", "dataMax"]}
            ticks={xTicks}
            tickFormatter={(t: number, i: number) =>
              lastTickLabel && i === xTicks.length - 1 ? lastTickLabel : tickLabel(t, spanDays)
            }
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            tickMargin={10}
            padding={{ left: 4, right: 4 }}
            hide={bare}
          />
          <YAxis
            domain={yDomain}
            ticks={yTicks}
            tickFormatter={(v: number) => formatAxis(v, format)}
            tick={axisStyle}
            axisLine={false}
            tickLine={false}
            width={compact ? 42 : 52}
            hide={bare}
          />
          <Tooltip
            cursor={{ stroke: "var(--color-faint)", strokeOpacity: 0.6, strokeWidth: 1, strokeDasharray: "3 3" }}
            isAnimationActive={false}
            content={({ active, payload }) => {
              const row = payload?.[0]?.payload as Row | undefined;
              if (onHover || !active || !row || row.value === null) return null;
              return (
                <div className="rounded-xl bg-ink px-3 py-2 text-xs shadow-pop">
                  <p className="text-canvas/60">{frequency === "decisions" ? fmtDay(row.date) : fmtPeriod(row.date, frequency)}</p>
                  <p className="mt-0.5 text-sm font-medium text-canvas tabular-nums">{formatValue(row.value, format)}</p>
                </div>
              );
            }}
          />
          {focus && (
            <ReferenceDot
              x={Date.parse(`${focus.date}T00:00:00Z`)}
              y={focus.value}
              r={7}
              fill={color}
              stroke="var(--color-card)"
              strokeWidth={3}
              ifOverflow="extendDomain"
            />
          )}
          <Area
            type={shape === "step" ? "stepAfter" : "monotone"}
            dataKey="value"
            stroke={color}
            strokeWidth={compact ? 1.75 : flat ? 2.25 : 2}
            strokeLinejoin="round"
            strokeLinecap="round"
            fill={fill ? (flat ? color : `url(#${gradientId})`) : "transparent"}
            fillOpacity={fill && flat ? 0.08 : 1}
            baseValue="dataMin"
            dot={false}
            activeDot={<GlowDot color={color} />}
            isAnimationActive={!reduced}
            animationDuration={compact ? 900 : 1100}
            animationEasing="ease-out"
          />
          {hasGap && (
            <Area
              type="linear"
              dataKey="bridge"
              connectNulls
              stroke={color}
              strokeOpacity={0.55}
              strokeWidth={1.5}
              strokeDasharray="4 4"
              fill="transparent"
              dot={false}
              activeDot={false}
              isAnimationActive={false}
              tooltipType="none"
            />
          )}
          {showHigh && (
            <ReferenceDot
              x={tAt(high)}
              y={high.value}
              r={3.5}
              fill="var(--color-card)"
              stroke={color}
              strokeWidth={2}
              label={(p: { viewBox?: { x?: number; y?: number } }) => (
                <Tag cx={(p.viewBox?.x ?? 0) + 3.5} cy={(p.viewBox?.y ?? 0) + 3.5} text={`High ${formatValue(high.value, format)}`} tone="soft" place={highPlace} />
              )}
            />
          )}
          {showLow && (
            <ReferenceDot
              x={tAt(low)}
              y={low.value}
              r={3.5}
              fill="var(--color-card)"
              stroke={color}
              strokeWidth={2}
              label={(p: { viewBox?: { x?: number; y?: number } }) => (
                <Tag cx={(p.viewBox?.x ?? 0) + 3.5} cy={(p.viewBox?.y ?? 0) + 3.5} text={`Low ${formatValue(low.value, format)}`} tone="soft" place={lowPlace} />
              )}
            />
          )}
          {markers && (
            <ReferenceDot
              x={tAt(last)}
              y={last.value}
              r={5}
              fill={color}
              stroke="var(--color-card)"
              strokeWidth={2.5}
              label={(p: { viewBox?: { x?: number; y?: number } }) => (
                <Tag cx={(p.viewBox?.x ?? 0) + 5} cy={(p.viewBox?.y ?? 0) + 5} text={formatValue(last.value, format)} tone="solid" place={lastPlace} />
              )}
            />
          )}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
