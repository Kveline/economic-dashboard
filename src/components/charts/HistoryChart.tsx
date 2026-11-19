"use client";

import { useState } from "react";
import type { Polarity } from "@/lib/data/indicators";
import { fmtDay, fmtPeriod, formatSigned, formatValue, type ValueFormat } from "@/lib/format";
import type { ChartStory as Story, RangeKey } from "@/lib/narrative";
import type { Frequency, Point } from "@/lib/series";
import { Segmented } from "../Segmented";
import { ChartStory } from "./ChartStory";
import { TimeChart } from "./TimeChart";

const RANGES: { key: RangeKey; label: string }[] = [
  { key: "5y", label: "5Y" },
  { key: "10y", label: "10Y" },
  { key: "all", label: "All" },
];

/**
 * The main detail-page chart: 5Y / 10Y / All switcher, a readout that follows
 * the pointer, and the matching "What the chart shows" story. Each range's
 * points and story are prepared on the server.
 */
export function HistoryChart({
  ranges,
  format,
  frequency,
  polarity,
  changeUnit,
  shape,
  band,
  zeroLine,
  quarterlyBefore,
  defaultRange = "5y",
}: {
  ranges: Record<RangeKey, { points: Point[]; story?: Story }>;
  format: ValueFormat;
  frequency: Frequency;
  polarity: Polarity;
  changeUnit: "pp" | "%";
  shape?: "smooth" | "step";
  band?: { from: number; to: number; label: string };
  zeroLine?: boolean;
  /** Dates before this are quarterly (CPI before the monthly series began). */
  quarterlyBefore?: string;
  defaultRange?: RangeKey;
}) {
  const [range, setRange] = useState<RangeKey>(defaultRange);
  const [hover, setHover] = useState<Point | null>(null);
  // A point pinned from the story tiles (start, now, low, high).
  const [focus, setFocus] = useState<Point | null>(null);
  const { points, story } = ranges[range];
  const first = points[0];
  const shown = hover ?? focus ?? points[points.length - 1];

  let change: number | undefined;
  if (first && shown) {
    change = changeUnit === "%" ? ((shown.value - first.value) / first.value) * 100 : shown.value - first.value;
  }
  const tone =
    change === undefined || Math.abs(change) < 1e-9
      ? "bg-chip text-muted"
      : (polarity === "up-bad") !== change > 0
        ? "bg-good-tint text-good"
        : "bg-bad-tint text-bad";
  const label = (d: string) =>
    frequency === "decisions" || frequency === "daily"
      ? fmtDay(d)
      : fmtPeriod(d, quarterlyBefore && d < quarterlyBefore ? "quarterly" : frequency);

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <Segmented
          label="Chart range"
          options={RANGES}
          value={range}
          onChange={(r) => {
            setRange(r);
            setHover(null);
            setFocus(null);
          }}
        />
        {shown && (
          <div className="flex flex-col items-end" aria-live="polite">
            <p className="flex items-center gap-2.5">
              {change !== undefined && first && (
                <span className={`rounded-full px-2 py-0.5 text-xs font-medium tabular-nums ${tone}`}>
                  {formatSigned(change, changeUnit)}
                </span>
              )}
              <span className="text-[28px] leading-none font-medium tracking-tight text-ink tabular-nums">
                {formatValue(shown.value, format)}
              </span>
            </p>
            <p className="mt-1.5 text-xs text-faint">
              {hover || focus ? label(shown.date) : `Latest · ${label(shown.date)}`}
              {first && <> · since {label(first.date)}</>}
            </p>
          </div>
        )}
      </div>

      <div key={range} className="animate-fade mt-6">
        <TimeChart
          points={points}
          format={format}
          frequency={frequency}
          shape={shape}
          fill
          flat
          markers
          color="var(--color-primary-mark)"
          height={320}
          xTickCount={6}
          band={band}
          zeroLine={zeroLine}
          onHover={setHover}
          focus={focus}
        />
        {band && (
          <p className="mt-3 flex items-center gap-2 pl-14 text-xs text-faint">
            <span className="h-2.5 w-5 rounded-sm border border-dashed border-good-mark/70 bg-good-mark/10" aria-hidden="true" />
            {band.label}
          </p>
        )}
      </div>

      {story && (
        <div key={`story-${range}`} className="animate-fade">
          <ChartStory story={story} onFocus={setFocus} />
        </div>
      )}
    </div>
  );
}
