import type { ReactNode } from "react";
import { toneFor, type IndicatorMeta } from "@/lib/data/indicators";
import { formatSigned, formatUnsigned, formatValue } from "@/lib/format";
import { addDays, addMonths, addYears, indexAt, type Point } from "@/lib/series";

/*
 * Key facts, combined: the facts from the six text tiles (InsightGrid),
 * grouped into two tiles that each show their numbers as a small picture.
 *   1. "How it has moved": the change over 30 days, 3 months, a year and
 *      5 years as bars either side of a zero line, so they compare at a glance.
 *   2. "Where it sits": today between the low and the high of the past
 *      12 months and of the past 10 years, with each average marked.
 * Each fact appears once on the page: the day's move stays under the big
 * number, and the ranges live here rather than in the "Past 12 months" card.
 */

const tile = "flex min-w-0 flex-col rounded-[16px] bg-inset p-4 sm:p-5";

function TileHead({ label, aside }: { label: string; aside?: ReactNode }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <p className="text-xs text-muted">{label}</p>
      {aside && <p className="text-xs text-faint">{aside}</p>}
    </div>
  );
}

/** One low-to-high line: a tick for the average, a dot for today. */
function RangeStrip({ label, points, now, fmt }: { label: string; points: Point[]; now: number; fmt: (v: number) => string }) {
  const values = points.map((p) => p.value);
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const avg = values.reduce((s, v) => s + v, 0) / values.length;
  const at = (v: number) => (hi === lo ? 50 : Math.min(100, Math.max(0, ((v - lo) / (hi - lo)) * 100)));
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3 text-xs">
        <span className="font-medium text-ink">{label}</span>
        <span className="flex items-center gap-1.5 text-faint tabular-nums">
          <span className="h-3 w-px bg-faint" aria-hidden="true" />
          average {fmt(avg)}
        </span>
      </div>
      <div className="relative mt-3.5 h-1.5 rounded-full bg-chip" role="img" aria-label={`${label}: low ${fmt(lo)}, average ${fmt(avg)}, high ${fmt(hi)}; now ${fmt(now)}`}>
        <span className="absolute -top-1.5 -bottom-1.5 w-px bg-faint" style={{ left: `${at(avg)}%` }} />
        <span
          className="absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-inset bg-primary-mark"
          style={{ left: `${at(now)}%` }}
        />
      </div>
      <div className="mt-2.5 flex justify-between gap-2 text-xs text-faint tabular-nums" aria-hidden="true">
        <span>
          low <span className="text-muted">{fmt(lo)}</span>
        </span>
        <span>
          high <span className="text-muted">{fmt(hi)}</span>
        </span>
      </div>
    </div>
  );
}

export function FactsPanel({ meta, series }: { meta: IndicatorMeta; series: Point[] }) {
  const cur = series[series.length - 1];
  if (!cur || series.length < 3) return null;
  const pct = meta.changeUnit === "%";
  const unit = pct ? "%" : "pp";
  const fmt = (v: number) => formatValue(v, meta.format);
  const delta = (from: number) => (pct ? (cur.value / from - 1) * 100 : cur.value - from);
  /** Up reads emerald and down rose unless the indicator says otherwise (e.g. inflation up is bad). */
  const good = (d: number) => {
    const t = toneFor(meta.polarity, d);
    return t === "neutral" ? d >= 0 : t === "good";
  };

  // 1. Change over each look-back that has its own earlier reading. Daily data can have holes
  // (gold): a reading much older than the look-back doesn't count, and longer look-backs
  // (3 and 10 years) fill in so the tile still has four rows.
  // The shortest look-back follows how often the figure comes out: 30 days for daily data and
  // Board decisions, one month for monthly data, none for quarterly (3 months is the last quarter).
  const shortest: { label: string; date: string; order: number }[] =
    meta.frequency === "monthly"
      ? [{ label: "1 month", date: addMonths(cur.date, -1), order: 0 }]
      : meta.frequency === "quarterly"
        ? []
        : [{ label: "30 days", date: addDays(cur.date, -30), order: 0 }];
  const lookbacks: { label: string; date: string; order: number; spare?: boolean }[] = [
    ...shortest,
    { label: "3 months", date: addMonths(cur.date, -3), order: 1 },
    { label: "1 year", date: addYears(cur.date, -1), order: 2 },
    { label: "3 years", date: addYears(cur.date, -3), order: 3, spare: true },
    { label: "5 years", date: addYears(cur.date, -5), order: 4 },
    { label: "10 years", date: addYears(cur.date, -10), order: 5, spare: true },
  ];
  const seen = new Set<string>([cur.date]);
  const found = lookbacks.flatMap((l) => {
    const i = indexAt(series, l.date);
    if (i < 0 || seen.has(series[i].date)) return [];
    if (meta.frequency === "daily" && series[i].date < addDays(l.date, -10)) return [];
    seen.add(series[i].date);
    return [{ ...l, then: series[i], change: delta(series[i].value) }];
  });
  const main = found.filter((m) => !m.spare);
  const moves = [...main, ...found.filter((m) => m.spare).slice(0, Math.max(0, 4 - main.length))].sort((x, y) => x.order - y.order);
  const maxMove = Math.max(...moves.map((m) => Math.abs(m.change)), 0.01);
  // Rates move in quarter points, so they need two decimals ("+0.25pp", not "+0.3pp").
  const digits = meta.format === "pct2" ? 2 : 1;
  // The zero line sits in the middle only when moves go both ways; otherwise bars get the full width.
  const allUp = moves.every((m) => m.change >= 0);
  const allDown = moves.every((m) => m.change <= 0);
  const zero = allUp ? 0 : allDown ? 100 : 50;
  const reach = allUp || allDown ? 100 : 50;

  // 2. The past 12 months and the past ten years.
  const since = (years: number) => series.filter((p) => p.date >= addYears(cur.date, -years));
  const year = since(1);
  const decade = since(10);
  const avg = decade.reduce((s, p) => s + p.value, 0) / decade.length;
  const dAvg = delta(avg);

  return (
    <div className="grid gap-2 self-stretch sm:gap-2.5 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
      {/* 1. how it has moved */}
      {moves.length > 0 && (
        <div className={tile}>
          <TileHead label="How it has moved" aside="change to today" />
          <ul className="mt-4 flex flex-1 flex-col justify-between gap-4">
            {moves.map((m, i) => {
              const up = m.change >= 0;
              const flat = Math.abs(m.change) < 0.05;
              const w = (Math.abs(m.change) / maxMove) * reach;
              return (
                <li key={m.label} className="grid grid-cols-[5.25rem_minmax(0,1fr)_3.75rem] items-center gap-3 sm:grid-cols-[6.5rem_minmax(0,1fr)_4.5rem]">
                  <span className="min-w-0">
                    <span className="block text-[13px] font-medium text-ink">{m.label}</span>
                    <span className="block truncate text-xs text-faint tabular-nums">was {fmt(m.then.value)}</span>
                  </span>
                  <span className="relative block h-3" aria-hidden="true">
                    <span className="absolute inset-y-0 w-px -translate-x-1/2 scale-y-[2.2] bg-soft" style={{ left: `${zero}%` }} />
                    <span
                      className={`animate-grow-x absolute inset-y-0 ${up ? "origin-left rounded-r-full" : "origin-right rounded-l-full"} ${
                        flat ? "bg-soft" : good(m.change) ? "bg-good-mark" : "bg-bad-mark"
                      }`}
                      style={{
                        width: `${Math.max(w, 1.5)}%`,
                        animationDelay: `${i * 80}ms`,
                        ...(up ? { left: `${zero}%` } : { right: `${100 - zero}%` }),
                      }}
                    />
                  </span>
                  <span className={`text-right text-[15px] font-medium tabular-nums ${flat ? "text-muted" : good(m.change) ? "text-good" : "text-bad"}`}>
                    {flat ? `${(0).toFixed(digits)}${unit}` : formatSigned(m.change, unit, digits)}
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {/* 2. where it sits */}
      <div className={tile}>
        <TileHead label="Where it sits" />
        <p className="mt-2 text-[17px] leading-snug font-medium tracking-tight text-ink tabular-nums">
          {Math.abs(dAvg) < 0.05 ? "About its 10-year average" : `${formatUnsigned(Math.abs(dAvg), unit, digits)} ${dAvg > 0 ? "above" : "below"} its 10-year average`}
        </p>
        <div className="mt-5 flex flex-1 flex-col justify-around gap-5">
          {year.length > 1 && <RangeStrip label="Past 12 months" points={year} now={cur.value} fmt={fmt} />}
          <RangeStrip label="Past 10 years" points={decade} now={cur.value} fmt={fmt} />
        </div>
      </div>
    </div>
  );
}
