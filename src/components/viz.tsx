import type { ReactNode } from "react";

/*
 * Server-rendered visualisations for the detail pages. Each one answers a
 * single plain question and animates in once. Colours come from the theme
 * tokens, so they work in light and dark mode.
 */

/** Small caption under a card title: how to read the visual. */
export function VizNote({ children }: { children: ReactNode }) {
  return <p className="-mt-3 mb-5 text-xs leading-5 text-faint">{children}</p>;
}

/* ------------------------------------------------------ DivergingBars ---- */

/**
 * Bars that grow left (negative) or right (positive) from a centre line,
 * e.g. the A$'s 12-month change against each currency.
 */
export function DivergingBars({
  items,
  format,
  posClass = "bg-primary",
  negClass = "bg-bad",
}: {
  items: { label: string; value: number; sub?: string }[];
  format: (v: number) => string;
  posClass?: string;
  negClass?: string;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 0.0001);
  return (
    <ul className="space-y-2.5">
      {items.map((item, i) => {
        const w = (Math.abs(item.value) / max) * 40; // leaves room for the label
        const pos = item.value >= 0;
        return (
          <li key={item.label} className="grid grid-cols-[minmax(0,8.5rem)_1fr] items-center gap-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate text-ink/90">{item.label}</span>
              {item.sub && <span className="block truncate text-[11px] text-faint">{item.sub}</span>}
            </span>
            <span className="relative h-7">
              <span className="absolute inset-y-0 left-1/2 w-px bg-line" aria-hidden="true" />
              <span
                className={`animate-grow-x absolute top-1/2 h-2.5 -translate-y-1/2 rounded-full ${pos ? `${posClass} origin-left` : `${negClass} origin-right`}`}
                style={{ left: pos ? "50%" : `${50 - w}%`, width: `${Math.max(w, 0.8)}%`, animationDelay: `${150 + i * 60}ms` }}
              />
              <span
                className={`absolute top-1/2 -translate-y-1/2 text-xs font-semibold tabular-nums ${pos ? "text-ink" : "text-bad"}`}
                style={pos ? { left: `calc(${50 + w}% + 6px)` } : { right: `calc(${50 + w}% + 6px)` }}
              >
                {format(item.value)}
              </span>
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ----------------------------------------------------------- Waterfall ---- */

export type WaterfallStep = { label: string; sub?: string; value: number; kind: "total" | "delta" };

/**
 * Horizontal waterfall: a starting total, the moves that changed it, and the
 * total it ended at. Deltas float from where the previous step ended.
 */
export function Waterfall({ steps, format, formatDelta }: { steps: WaterfallStep[]; format: (v: number) => string; formatDelta: (v: number) => string }) {
  const bars: (WaterfallStep & { from: number; to: number })[] = [];
  for (const s of steps) {
    const prevEnd = bars.length ? bars[bars.length - 1].to : 0;
    bars.push(s.kind === "total" ? { ...s, from: 0, to: s.value } : { ...s, from: prevEnd, to: prevEnd + s.value });
  }
  const lo = Math.min(...bars.map((b) => (b.kind === "total" ? b.to : Math.min(b.from, b.to))));
  const hi = Math.max(...bars.map((b) => Math.max(b.from, b.to)));
  // Zoom in on the interesting part rather than starting at zero.
  const pad = (hi - lo) * 0.6 || hi * 0.05;
  const min = Math.max(0, lo - pad);
  const span = hi - min || 1;
  const x = (v: number) => ((v - min) / span) * 100;

  return (
    <ul className="space-y-3">
      {bars.map((b, i) => {
        const total = b.kind === "total";
        const left = total ? 0 : x(Math.min(b.from, b.to));
        const width = total ? x(b.to) : Math.max(Math.abs(x(b.to) - x(b.from)), 0.8);
        const up = b.to >= b.from;
        const color = total ? "bg-primary" : up ? "bg-soft" : "bg-bad";
        return (
          <li key={b.label} className="grid grid-cols-[minmax(0,8.5rem)_1fr_auto] items-center gap-3 text-sm">
            <span className="min-w-0">
              <span className="block truncate text-ink/90">{b.label}</span>
              {b.sub && <span className="block truncate text-[11px] text-faint">{b.sub}</span>}
            </span>
            <span className="relative h-8 rounded-lg bg-inset">
              <span
                className={`animate-grow-x absolute inset-y-1.5 origin-left rounded-md ${color}`}
                style={{ left: `${left}%`, width: `${width}%`, animationDelay: `${200 + i * 220}ms` }}
              />
            </span>
            <span className={`w-20 text-right text-xs font-semibold tabular-nums ${total ? "text-ink" : up ? "text-primary" : "text-bad"}`}>
              {total ? format(b.value) : formatDelta(b.value)}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* --------------------------------------------------------- ValueBars ---- */

/** Simple horizontal bars with a value at the end (e.g. what A$1,000 became). */
export function ValueBars({
  items,
  format,
  baseline,
  baselineLabel,
}: {
  items: { label: string; value: number }[];
  format: (v: number) => string;
  /** Optional reference value drawn as a dashed line (e.g. the A$1,000 paid). */
  baseline?: number;
  baselineLabel?: string;
}) {
  const max = Math.max(...items.map((i) => i.value), baseline ?? 0) * 1.08;
  return (
    <div>
      <ul className="space-y-3">
        {items.map((item, i) => (
          <li key={item.label} className="grid grid-cols-[minmax(0,6.5rem)_1fr] items-center gap-3 text-sm">
            <span className="truncate text-ink/90">{item.label}</span>
            <span className="relative flex h-8 items-center">
              {baseline !== undefined && (
                <span
                  aria-hidden="true"
                  className="absolute inset-y-0 z-10 border-l border-dashed border-ink/30"
                  style={{ left: `${(baseline / max) * 100}%` }}
                />
              )}
              <span
                className={`animate-grow-x h-full origin-left rounded-lg ${baseline !== undefined && item.value < baseline ? "bg-bad/80" : "bg-primary"}`}
                style={{ width: `${(item.value / max) * 100}%`, animationDelay: `${200 + i * 90}ms` }}
              />
              <span className="ml-2 text-xs font-semibold whitespace-nowrap tabular-nums">{format(item.value)}</span>
            </span>
          </li>
        ))}
      </ul>
      {baselineLabel && (
        <p className="mt-4 flex items-center gap-2 text-xs text-faint">
          <span className="h-3 border-l border-dashed border-ink/40" aria-hidden="true" />
          {baselineLabel}
        </p>
      )}
    </div>
  );
}

/* ----------------------------------------------------- DecisionDots ---- */

export type Decision = { date: string; change: number; rate: number; label: string };

/** One dot per RBA meeting, oldest to newest: raised, held or cut. */
export function DecisionDots({ decisions }: { decisions: Decision[] }) {
  const ups = decisions.filter((d) => d.change > 0).length;
  const downs = decisions.filter((d) => d.change < 0).length;
  const holds = decisions.length - ups - downs;
  return (
    <div>
      <ol className="flex flex-wrap gap-2" aria-label={`${ups} rises, ${holds} holds and ${downs} cuts`}>
        {decisions.map((d, i) => {
          const kind = d.change > 0 ? "up" : d.change < 0 ? "down" : "hold";
          return (
            <li
              key={d.date}
              title={d.label}
              className={`animate-fade grid size-9 place-items-center rounded-full text-xs font-bold transition-transform hover:scale-110 ${
                kind === "up" ? "bg-bad text-on-primary" : kind === "down" ? "bg-good text-on-primary" : "bg-inset text-faint ring-1 ring-line"
              }`}
              style={{ animationDelay: `${100 + i * 35}ms` }}
            >
              <span aria-hidden="true">{kind === "up" ? "↑" : kind === "down" ? "↓" : "–"}</span>
              <span className="sr-only">{d.label}</span>
            </li>
          );
        })}
      </ol>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs text-faint">
        <span>
          {decisions[0]?.label.split(" · ")[0]} → {decisions[decisions.length - 1]?.label.split(" · ")[0]}
        </span>
        <span className="flex items-center gap-3">
          <Legend className="bg-bad" text={`${ups} raised`} />
          <Legend className="bg-inset ring-1 ring-line" text={`${holds} held`} />
          <Legend className="bg-good" text={`${downs} cut`} />
        </span>
      </div>
    </div>
  );
}

function Legend({ className, text }: { className: string; text: string }) {
  return (
    <span className="flex items-center gap-1.5">
      <span className={`size-2.5 rounded-full ${className}`} aria-hidden="true" />
      {text}
    </span>
  );
}

/* --------------------------------------------------------- TargetScale ---- */

/**
 * Where today sits against a target band, on one horizontal scale. The
 * past-ten-years range is shaded faintly behind, so the reader sees the
 * target, today and the usual spread at a glance.
 */
export function TargetScale({
  value,
  band,
  range,
  format,
  inTarget,
}: {
  value: number;
  band: [number, number];
  range: { low: number; high: number; label: string };
  format: (v: number) => string;
  /** Share of past readings inside the band, 0–1. */
  inTarget: number;
}) {
  const min = Math.min(0, Math.floor(range.low));
  const max = Math.max(Math.ceil(range.high) + 1, Math.ceil(value) + 1, band[1] + 3);
  const pos = (v: number) => ((Math.min(max, Math.max(min, v)) - min) / (max - min)) * 100;
  const gap = value > band[1] ? value - band[1] : value < band[0] ? value - band[0] : 0;
  const tone = gap > 0 ? "bad" : gap < 0 ? "primary" : "good";
  const toneText = { bad: "text-bad", primary: "text-primary", good: "text-good" }[tone];
  const toneBg = { bad: "bg-bad-mark", primary: "bg-primary-mark", good: "bg-good-mark" }[tone];
  const toneSoft = { bad: "bg-bad-tint-strong text-bad", primary: "bg-primary-tint text-primary", good: "bg-good-tint-strong text-good" }[tone];
  const verdict =
    gap === 0 ? "Inside the target" : `${Math.abs(gap).toFixed(1)} pp ${gap > 0 ? "above the top" : "below the bottom"} of the target`;
  const edge = (t: number) => (t === min ? "" : t === max ? "-translate-x-full" : "-translate-x-1/2");

  return (
    <div>
      {/* today, then the verdict as a soft pill */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
        <p className="text-[40px] leading-none font-light tracking-tight tabular-nums">{format(value)}</p>
        <span className={`rounded-full px-3 py-1 text-xs font-medium ${toneSoft}`}>{verdict}</span>
      </div>
      <p className="mt-2 text-xs text-faint">annual rate today</p>

      {/* one quiet scale: grey = past ten years, green = target, dot = today */}
      <div className="relative mt-12" role="img" aria-label={`${format(value)}; target ${format(band[0])} to ${format(band[1])}; ${verdict}`}>
        <div className="absolute bottom-full mb-3 flex -translate-x-1/2 flex-col items-center transition-[left] duration-700" style={{ left: `${pos(value)}%` }}>
          <span className={`animate-fade text-[11px] font-medium tabular-nums ${toneText}`}>today</span>
          <span className="mt-1 h-3 w-px bg-faint/60" />
        </div>
        <div className="relative h-1.5 rounded-full bg-chip">
          <div
            className="animate-grow-x absolute inset-y-0 origin-left rounded-full bg-soft"
            style={{ left: `${pos(range.low)}%`, width: `${pos(range.high) - pos(range.low)}%` }}
            title={`${range.label}: ${format(range.low)} to ${format(range.high)}`}
          />
          <div className="absolute inset-y-0 rounded-full bg-good-mark" style={{ left: `${pos(band[0])}%`, width: `${pos(band[1]) - pos(band[0])}%` }} />
          <div
            className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-card ${toneBg}`}
            style={{ left: `${pos(value)}%` }}
          />
        </div>

        <div className="relative mt-3 h-4 text-[11px] text-faint tabular-nums">
          {[min, max].map((t) => (
            <span key={t} className={`absolute ${edge(t)}`} style={{ left: `${pos(t)}%` }}>
              {format(t).replace(/\.0+$/, "")}
            </span>
          ))}
          <span
            className="absolute flex -translate-x-1/2 flex-col items-center whitespace-nowrap text-good"
            style={{ left: `${(pos(band[0]) + pos(band[1])) / 2}%` }}
          >
            <span className="tabular-nums">
              {format(band[0])}–{format(band[1])}
            </span>
            <span className="text-[10px] text-faint">target</span>
          </span>
        </div>
      </div>

      {/* three numbers in an open row, split by hairlines */}
      <dl className="mt-10 grid grid-cols-3 border-t border-line">
        {[
          { k: "10-year low", v: format(range.low) },
          { k: "10-year high", v: format(range.high) },
          { k: "Months on target", v: `${Math.round(inTarget * 100)}%` },
        ].map((d, i) => (
          <div key={d.k} className={`pt-4 ${i ? "border-l border-line pl-4 sm:pl-6" : "pr-4"}`}>
            <dt className="text-xs text-faint">{d.k}</dt>
            <dd className="mt-1 text-[19px] font-light tracking-tight text-ink tabular-nums">{d.v}</dd>
          </div>
        ))}
      </dl>
    </div>
  );
}

/* --------------------------------------------------------------- Waffle ---- */

/** One small person: head and shoulders, 12 × 14. */
function Person({ className }: { className: string }) {
  return (
    <svg viewBox="0 0 12 14" className={className} fill="currentColor" aria-hidden="true">
      <circle cx="6" cy="3.2" r="2.9" />
      <path d="M0.6 14v-2.2C0.6 9 2.6 7.4 6 7.4s5.4 1.6 5.4 4.4V14z" />
    </svg>
  );
}

/** One person, filled rose from the left by `fill` (0–1), soft grey otherwise. */
function PersonCell({ fill, delay = 0, className }: { fill: number; delay?: number; className: string }) {
  return (
    <span className={`animate-fade relative block ${className}`} style={{ animationDelay: `${delay}ms` }}>
      <Person className="absolute inset-0 size-full text-soft" />
      {fill > 0 && (
        <span className="absolute inset-0" style={{ clipPath: `inset(0 ${(1 - fill) * 100}% 0 0)` }}>
          <Person className="size-full text-bad-mark" />
        </span>
      )}
    </span>
  );
}

/**
 * The same people at small size, one row of 10 (a value under 10 in 100 fits in
 * one row, like the grid's top row), so a stat box can be compared at a glance.
 */
export function PeopleRow({ value, className = "" }: { value: number; className?: string }) {
  const full = Math.floor(value);
  const part = value - full;
  return (
    <div className={`flex gap-1 ${className}`} aria-hidden="true">
      {Array.from({ length: 10 }, (_, i) => (
        <PersonCell key={i} fill={i < full ? 1 : i === full ? part : 0} className="h-[14px] w-[12px]" />
      ))}
    </div>
  );
}

/**
 * 10 × 10 grid of people: `value` of every 100 are highlighted in rose (the
 * last one partly), the rest in soft blue. `caption` sits beside it.
 */
export function Waffle({ value, caption }: { value: number; caption: ReactNode }) {
  const full = Math.floor(value);
  const part = value - full;
  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-center sm:gap-8">
      <div className="shrink-0">
        <div className="grid w-fit grid-cols-10 gap-x-2 gap-y-1.5" role="img" aria-label={`${value.toFixed(1)} out of every 100 people`}>
          {Array.from({ length: 100 }, (_, i) => (
            <PersonCell key={i} fill={i < full ? 1 : i === full ? part : 0} delay={i * 6} className="h-[21px] w-[18px]" />
          ))}
        </div>
        <div className="mt-3 flex gap-4 text-[11px] text-faint">
          <span className="flex items-center gap-1.5">
            <Person className="h-3 w-2.5 text-bad-mark" /> looking for work
          </span>
          <span className="flex items-center gap-1.5">
            <Person className="h-3 w-2.5 text-soft" /> has a job
          </span>
        </div>
      </div>
      <div className="min-w-0 flex-1">{caption}</div>
    </div>
  );
}

/* ----------------------------------------------------------- LinedUp ---- */

/**
 * Every reading lined up from lowest to highest (one column per slice of
 * months), with today's place marked. Reads as "if you queued every month by
 * its rate, today would stand here".
 */
export function LinedUp({
  points,
  current,
  format,
  when,
  columns = 40,
}: {
  points: { date: string; value: number }[];
  current: number;
  format: (v: number) => string;
  when: (date: string) => string;
  columns?: number;
}) {
  const sorted = [...points].sort((a, b) => a.value - b.value);
  const n = sorted.length;
  const cols = Array.from({ length: columns }, (_, i) => sorted[Math.min(n - 1, Math.floor(((i + 0.5) / columns) * n))].value);
  const lowerShare = sorted.filter((p) => p.value < current).length / n;
  const higherShare = sorted.filter((p) => p.value > current).length / n;
  const todayCol = Math.min(columns - 1, Math.floor(lowerShare * columns));
  const best = sorted[0];
  const worst = sorted[n - 1];
  const yMax = Math.ceil(worst.value / 2) * 2;
  const h = (v: number) => (v / yMax) * 100;
  const yTicks = Array.from({ length: yMax / 2 + 1 }, (_, i) => i * 2).filter((t) => t > 0);
  const pct = (f: number) => `${Math.round(f * 100)}%`;
  const colW = 100 / columns;

  return (
    <div>
      <p className="text-[15px] leading-6 text-muted">
        Today&apos;s rate is lower than in <strong className="font-semibold text-good">{pct(higherShare)}</strong> of all months since{" "}
        {points[0].date.slice(0, 4)}.
      </p>

      <div className="mt-10 grid grid-cols-[2rem_1fr] gap-x-2">
        <div className="relative h-40 text-[10px] text-faint tabular-nums" aria-hidden="true">
          {yTicks.map((t) => (
            <span key={t} className="absolute right-0 translate-y-1/2" style={{ bottom: `${h(t)}%` }}>
              {t}%
            </span>
          ))}
        </div>

        <div className="relative h-40">
          {yTicks.map((t) => (
            <span key={t} className="absolute inset-x-0 h-px bg-line" style={{ bottom: `${h(t)}%` }} aria-hidden="true" />
          ))}
          <div className="relative flex h-full items-end gap-[3px]" role="img" aria-label={`Today is lower than ${pct(higherShare)} of months`}>
            {cols.map((v, i) => {
              const now = i === todayCol;
              return (
                <div key={i} className="relative flex h-full flex-1 items-end">
                  <div
                    className={`animate-grow-y w-full origin-bottom rounded-t-[4px] ${now ? "bg-primary-mark" : i < todayCol ? "bg-good-mark" : "bg-soft"}`}
                    style={{ height: `${h(v)}%`, animationDelay: `${i * 15}ms` }}
                    title={`${format(v)}`}
                  />
                  {now && (
                    <span className="absolute left-1/2 flex -translate-x-1/2 flex-col items-center" style={{ bottom: `calc(${h(v)}% + 6px)` }}>
                      <span className="rounded-md bg-primary-solid px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap text-on-primary-solid">Today {format(current)}</span>
                      <span className="h-3 w-px bg-primary-mark" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>
          {/* labelled ends */}
          <span className="absolute left-0 rounded bg-card pr-1 text-[10px] whitespace-nowrap text-faint" style={{ bottom: `calc(${h(Math.max(...cols.slice(0, 8)))}% + 6px)` }}>
            Lowest <strong className="font-semibold text-ink">{format(best.value)}</strong> · {when(best.date)}
          </span>
          <span className="absolute right-0 rounded bg-card pl-1 text-right text-[10px] whitespace-nowrap text-faint" style={{ bottom: `calc(${h(cols[columns - 1])}% + 6px)` }}>
            Highest <strong className="font-semibold text-ink">{format(worst.value)}</strong> · {when(worst.date)}
          </span>
        </div>

        {/* brackets: which months are lower / higher */}
        <span />
        <div className="relative mt-2 h-10 border-t border-line text-xs" aria-hidden="true">
          <span className="absolute top-2" style={{ left: 0, width: `${todayCol * colW}%` }}>
            <span className="block h-1.5 rounded-b border-x border-b border-good-mark" />
            <span className="mt-1 block text-center whitespace-nowrap text-good">
              <strong className="font-semibold">{pct(lowerShare)}</strong> lower
            </span>
          </span>
          <span className="absolute top-2" style={{ left: `${(todayCol + 1) * colW}%`, right: 0 }}>
            <span className="block h-1.5 rounded-b border-x border-b border-faint/60" />
            <span className="mt-1 block text-center text-muted">
              <strong className="font-semibold text-ink">{pct(higherShare)}</strong> of months had higher unemployment than today
            </span>
          </span>
        </div>
      </div>
    </div>
  );
}

/** Small cards with each decade's average, scaled bars for comparison. */
export function DecadeAverages({
  items,
  format,
  highlight = "min",
}: {
  items: { label: string; value: number; partial?: boolean }[];
  format: (v: number) => string;
  /** Which decade is "best" and shown in emerald: the lowest (unemployment) or highest (growth). */
  highlight?: "min" | "max";
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)));
  const minIdx = items.reduce((b, it, i) => ((highlight === "min" ? it.value < items[b].value : it.value > items[b].value) ? i : b), 0);
  return (
    <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
      {items.map((it, i) => (
        <div key={it.label} className="rounded-[16px] bg-inset px-4 py-4 sm:px-5">
          <p className="text-xs text-faint">
            {it.label}
            {it.partial && " so far"}
          </p>
          <p className={`mt-2 text-xl leading-none font-medium tracking-tight tabular-nums ${i === minIdx ? "text-good" : "text-ink"}`}>{format(it.value)}</p>
          <div className="mt-3 h-1.5 rounded-full bg-chip">
            <div className={`animate-grow-x h-full origin-left rounded-full ${i === minIdx ? "bg-good-mark" : "bg-soft"}`} style={{ width: `${Math.max(2, (Math.abs(it.value) / max) * 100)}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

/* ------------------------------------------------------ ReleaseList ---- */

/**
 * Latest releases, newest first: the rate as a short bar (scaled to the
 * shown range so small moves are visible) and the change as a pill. A rise
 * is rose, a fall emerald (for "lower is better" measures).
 */
export function ReleaseList({
  items,
  format,
}: {
  items: { label: string; value: number; change: number }[];
  format: (v: number) => string;
}) {
  const vals = items.map((i) => i.value);
  const lo = Math.min(...vals) - 0.3;
  const hi = Math.max(...vals);
  const w = (v: number) => 25 + ((v - lo) / (hi - lo || 1)) * 75;

  return (
    <ul className="divide-y divide-line rounded-[16px] bg-inset px-4">
      {items.map((it, i) => {
        const flat = Math.abs(it.change) < 0.05;
        const up = it.change > 0;
        const pill = flat ? "bg-card text-muted ring-1 ring-line" : up ? "bg-bad/10 text-bad" : "bg-good/10 text-good";
        return (
          <li
            key={it.label}
            className="grid grid-cols-[4.75rem_1fr_3rem_5rem] items-center gap-3 py-3 text-sm"
          >
            <span className={i === 0 ? "font-medium text-ink" : "text-muted"}>{it.label}</span>
            <span className="h-1.5 rounded-full bg-ink/10">
              <span
                className={`animate-grow-x block h-full origin-left rounded-full ${i === 0 ? "bg-primary" : "bg-soft"}`}
                style={{ width: `${w(it.value)}%`, animationDelay: `${i * 60}ms` }}
              />
            </span>
            <span className={`text-right tabular-nums ${i === 0 ? "font-semibold" : "font-medium"}`}>{format(it.value)}</span>
            <span className={`justify-self-end rounded-full px-2 py-0.5 text-[11px] font-semibold whitespace-nowrap tabular-nums ${pill}`}>
              {flat ? "No change" : `${up ? "▲" : "▼"} ${Math.abs(it.change).toFixed(1)}pp`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}

/* ------------------------------------------------------- PeriodBars ---- */

/**
 * Vertical bars above/below zero, e.g. quarterly GDP growth. Hover a bar for
 * its value; an optional dashed "typical" line and a shaded period (e.g.
 * COVID) give context. Bars beyond the scale are cut with a break mark and
 * their real value written beside them.
 */
export function PeriodBars({
  items,
  format,
  typical,
  period,
  clampUp = 4,
  clampDown = 2,
}: {
  items: { date: string; label: string; value: number }[];
  format: (v: number) => string;
  typical?: { value: number; label: string };
  period?: { from: string; to: string; label: string };
  /** Scale limits above and below zero; bigger bars are cut short and labelled. */
  clampUp?: number;
  clampDown?: number;
}) {
  const rawTop = Math.min(clampUp, Math.max(0.5, ...items.map((i) => i.value)));
  const rawBottom = Math.min(clampDown, Math.max(0.5, ...items.map((i) => -i.value)));
  const step = rawTop + rawBottom > 3 ? 1 : 0.5;
  const top = Math.ceil(rawTop / step) * step;
  const bottom = Math.ceil(rawBottom / step) * step;
  const span = top + bottom;
  const zero = (top / span) * 100; // % from the top
  const ticks: number[] = [];
  for (let t = -bottom; t <= top + 1e-9; t += step) ticks.push(Number(t.toFixed(2)));
  const yPct = (v: number) => ((top - v) / span) * 100;
  const n = items.length;
  const lastIdx = n - 1;

  const inPeriod = period ? items.map((it) => it.date >= period.from && it.date <= period.to) : [];
  const pFirst = inPeriod.indexOf(true);
  const pLast = inPeriod.lastIndexOf(true);

  const years: { year: string; count: number }[] = [];
  for (const it of items) {
    const y = it.date.slice(0, 4);
    if (years.length && years[years.length - 1].year === y) years[years.length - 1].count++;
    else years.push({ year: y, count: 1 });
  }

  return (
    <div className="grid grid-cols-[2.5rem_1fr] gap-x-2">
      <div className="relative h-56 text-[10px] text-faint tabular-nums" aria-hidden="true">
        {ticks.map((t) => (
          <span key={t} className="absolute right-0 -translate-y-1/2" style={{ top: `${yPct(t)}%` }}>
            {t > 0 ? "+" : ""}
            {t}%
          </span>
        ))}
      </div>

      <div className="relative h-56" role="img" aria-label="Growth in each quarter">
        {/* shaded period */}
        {period && pFirst >= 0 && (
          <div
            className="absolute inset-y-0 rounded-lg bg-inset"
            style={{ left: `${(pFirst / n) * 100}%`, width: `${((pLast - pFirst + 1) / n) * 100}%` }}
            aria-hidden="true"
          >
            <span className="absolute top-1.5 left-2 text-[10px] font-medium text-faint">{period.label}</span>
          </div>
        )}
        {ticks.map((t) => (
          <span key={t} className={`absolute inset-x-0 h-px ${t === 0 ? "bg-faint/70" : "bg-line"}`} style={{ top: `${yPct(t)}%` }} aria-hidden="true" />
        ))}
        {typical && (
          <div className="pointer-events-none absolute inset-x-0 z-[5] border-t border-dashed border-ink/50" style={{ top: `${yPct(typical.value)}%` }} aria-hidden="true">
            <span className="absolute left-1 -translate-y-full rounded bg-card/90 px-1 pb-0.5 text-[10px] text-muted">{typical.label}</span>
          </div>
        )}

        <div className="absolute inset-0 flex gap-1 px-0.5">
          {items.map((it, i) => {
            const pos = it.value >= 0;
            const limit = pos ? top : bottom;
            const capped = Math.abs(it.value) > limit;
            const h = (Math.min(Math.abs(it.value), limit) / span) * 100;
            const latest = i === lastIdx;
            const fill = !pos ? "bg-bad-mark" : latest ? "bg-primary-mark" : "bg-soft";
            const barEdge = pos ? 100 - zero + h : zero + h; // % from bottom (pos) or top (neg)
            return (
              <div key={it.date} className="group relative flex-1">
                <div
                  className={`animate-grow-y absolute inset-x-0 transition-opacity group-hover:opacity-75 ${pos ? "origin-bottom rounded-t-[4px]" : "origin-top rounded-b-[4px]"} ${fill}`}
                  style={{ ...(pos ? { bottom: `${100 - zero}%` } : { top: `${zero}%` }), height: `${Math.max(h, 0.8)}%`, animationDelay: `${i * 18}ms` }}
                >
                  {capped && (
                    <span className={`absolute inset-x-0 h-[3px] -skew-y-[20deg] bg-card ${pos ? "top-2" : "bottom-2"}`} aria-hidden="true" />
                  )}
                </div>
                {capped && (
                  <span
                    className={`absolute left-full ml-1 text-[10px] font-semibold whitespace-nowrap tabular-nums ${pos ? "text-primary" : "text-bad"}`}
                    style={pos ? { top: 0 } : { bottom: 0 }}
                  >
                    {format(it.value)}
                  </span>
                )}
                {latest && (
                  <span
                    className="absolute right-0 rounded bg-primary-solid px-1 text-[10px] font-semibold whitespace-nowrap text-on-primary-solid tabular-nums group-hover:hidden"
                    style={pos ? { bottom: `calc(${barEdge}% + 4px)` } : { top: `calc(${barEdge}% + 4px)` }}
                  >
                    {format(it.value)}
                  </span>
                )}
                {/* hover readout */}
                <span
                  className={`pointer-events-none absolute z-10 hidden rounded-md bg-ink px-2 py-1 text-[11px] whitespace-nowrap text-canvas shadow-pop group-hover:block ${
                    i > n * 0.75 ? "right-0" : i < n * 0.25 ? "left-0" : "left-1/2 -translate-x-1/2"
                  }`}
                  style={pos ? { bottom: `calc(${Math.min(barEdge, 96)}% + 6px)` } : { top: `calc(${Math.min(barEdge, 96)}% + 6px)` }}
                >
                  {it.label} <strong className="font-semibold">{format(it.value)}</strong>
                </span>
              </div>
            );
          })}
        </div>
      </div>

      <span />
      <div className="mt-2 flex px-0.5 text-[10px] text-faint">
        {years.map((y) => (
          <span key={y.year} className="border-l border-line text-center first:border-l-0" style={{ width: `${(y.count / n) * 100}%` }}>
            {y.count >= 2 ? y.year : ""}
          </span>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------- ChangeRows ---- */

/**
 * Small ± changes, one row each: name with a plain explanation, a bar that
 * grows right (rise) or left (fall) from a centre zero line, and the value as
 * a pill. Keeps direction obvious at a glance.
 */
export function ChangeRows({
  items,
  format,
}: {
  items: { name: string; note?: string; value: number }[];
  format: (v: number) => string;
}) {
  const max = Math.max(...items.map((i) => Math.abs(i.value)), 0.1);
  const sorted = [...items].sort((a, b) => b.value - a.value);
  return (
    <div>
      <div className="mb-2 hidden grid-cols-[minmax(0,15rem)_1fr_5rem] gap-4 px-6 text-[11px] text-faint sm:grid">
        <span />
        <span className="flex justify-between">
          <span>← fell</span>
          <span>rose →</span>
        </span>
        <span />
      </div>
      <ul className="divide-y divide-line rounded-[16px] bg-inset px-4 sm:px-5">
        {sorted.map((it, i) => {
          const flat = Math.abs(it.value) < 0.05;
          const up = it.value > 0;
          const w = (Math.abs(it.value) / max) * 50;
          const pill = flat ? "bg-card text-muted ring-1 ring-line" : up ? "bg-good-tint text-good" : "bg-bad-tint text-bad";
          return (
            <li key={it.name} className="grid grid-cols-[minmax(0,1fr)_5rem] items-center gap-x-4 gap-y-2 py-3.5 sm:grid-cols-[minmax(0,15rem)_1fr_5rem]">
              <div className="min-w-0">
                <p className="text-sm font-medium">{it.name}</p>
                {it.note && <p className="text-xs text-faint">{it.note}</p>}
              </div>
              <div className="relative order-last col-span-2 h-2.5 sm:order-none sm:col-span-1" aria-hidden="true">
                <span className="absolute inset-y-0 left-0 right-0 my-auto h-1.5 rounded-full bg-chip" />
                <span className="absolute -inset-y-1 left-1/2 w-px bg-faint/70" />
                {!flat && (
                  <span
                    className={`animate-grow-x absolute inset-y-0 my-auto h-1.5 rounded-full ${up ? "origin-left bg-good-mark" : "origin-right bg-bad-mark"}`}
                    style={{ [up ? "left" : "right"]: "50%", width: `${w}%`, animationDelay: `${i * 70}ms` }}
                  />
                )}
                {flat && <span className="absolute top-1/2 left-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-faint" />}
              </div>
              <span className={`justify-self-end rounded-full px-2.5 py-0.5 text-xs font-semibold whitespace-nowrap tabular-nums ${pill}`}>
                {flat ? "No change" : `${up ? "▲" : "▼"} ${format(Math.abs(it.value))}`}
              </span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

/* ------------------------------------------------------ CurrencyMoves ---- */

export type CurrencyMove = { code: string; name: string; symbol: string; now: number; then: number; change: number };

/**
 * "Stronger or weaker?": a verdict, then one row per currency with what A$1
 * buys now vs a year ago and the change on a shared ± scale with gridlines.
 */
export function CurrencyMoves({ items }: { items: CurrencyMove[] }) {
  const stronger = items.filter((i) => i.change > 0).length;
  const maxAbs = Math.max(...items.map((i) => Math.abs(i.change)), 1);
  const lim = Math.ceil(maxAbs / 5) * 5; // nice symmetric scale, e.g. ±10%
  const ticks = [-lim, -lim / 2, 0, lim / 2, lim];
  const x = (v: number) => 50 + (v / lim) * 50;
  const rate = (v: number) => (v >= 10 ? v.toFixed(2) : v.toFixed(4));
  const avg = items.reduce((s, i) => s + i.change, 0) / (items.length || 1);

  return (
    <div>
      {/* verdict */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 rounded-[16px] bg-inset px-5 py-4">
        <p className="text-[28px] leading-none font-medium tracking-tight">
          {stronger}
          <span className="text-faint"> / {items.length}</span>
        </p>
        <p className="text-sm leading-5 text-muted">
          The Australian dollar is <strong className="font-semibold text-ink">stronger</strong> against {stronger} of {items.length}{" "}
          major currencies than a year ago, by <strong className="font-semibold text-ink">{avg >= 0 ? "+" : "−"}{Math.abs(avg).toFixed(1)}%</strong> on
          average. Your money goes further overseas.
        </p>
      </div>

      {/* scale header */}
      <div className="mt-6 hidden grid-cols-[minmax(0,15rem)_1fr_4.5rem] gap-4 text-[11px] text-faint sm:grid">
        <span>Currency · A$1 buys</span>
        <span className="relative h-4">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>
              {t > 0 ? "+" : t < 0 ? "−" : ""}
              {Math.abs(t)}%
            </span>
          ))}
        </span>
        <span className="text-right">12 months</span>
      </div>

      <ul className="mt-2 divide-y divide-line">
        {items.map((it, i) => {
          const pos = it.change >= 0;
          const left = pos ? 50 : x(it.change);
          const width = Math.abs(x(it.change) - 50);
          return (
            <li key={it.code} className="group grid grid-cols-[1fr_auto] items-center gap-x-4 gap-y-2 py-3.5 sm:grid-cols-[minmax(0,15rem)_1fr_4.5rem]">
              <div className="flex min-w-0 items-center gap-3">
                <span className="grid h-9 w-12 shrink-0 place-items-center rounded-xl bg-inset text-[11px] font-bold tracking-wide text-primary transition group-hover:bg-primary-solid group-hover:text-on-primary-solid">
                  {it.code}
                </span>
                <span className="min-w-0">
                  <span className="block truncate text-sm font-medium">{it.name}</span>
                  <span className="block truncate text-xs text-faint tabular-nums">
                    <span className="text-ink/80">
                      {it.symbol}
                      {rate(it.now)}
                    </span>{" "}
                    · was {it.symbol}
                    {rate(it.then)}
                  </span>
                </span>
              </div>

              {/* bar on the shared scale */}
              <div className="relative col-span-2 h-7 sm:col-span-1" aria-hidden="true">
                {ticks.map((t) => (
                  <span
                    key={t}
                    className={`absolute inset-y-0 w-px ${t === 0 ? "bg-ink/25" : "bg-line"}`}
                    style={{ left: `${x(t)}%` }}
                  />
                ))}
                <span
                  className={`animate-grow-x absolute top-1/2 h-3 -translate-y-1/2 rounded-full ${pos ? "origin-left bg-good-mark" : "origin-right bg-bad-mark"}`}
                  style={{ left: `${left}%`, width: `${Math.max(width, 0.8)}%`, animationDelay: `${150 + i * 70}ms` }}
                />
                <span
                  className={`absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card ${pos ? "bg-good-mark" : "bg-bad-mark"}`}
                  style={{ left: `${x(it.change)}%` }}
                />
              </div>

              <span
                className={`col-start-2 row-start-1 justify-self-end rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums sm:col-start-3 sm:row-start-auto ${
                  pos ? "bg-good-tint text-good" : "bg-bad-tint text-bad"
                }`}
              >
                {pos ? "+" : "−"}
                {Math.abs(it.change).toFixed(1)}%
              </span>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 text-xs text-faint">Right of the centre line: A$1 buys more than a year ago. Left: it buys less.</p>
    </div>
  );
}

/* -------------------------------------------------------- YearRanges ---- */

export type YearRange = { year: string; low: number; high: number; avg: number; partial?: boolean };

/**
 * One row per year on a shared scale: a bar from the year's low to its high
 * and a dot at the average, with the average written out and the change on
 * the year before. Easier to read than a colour grid.
 */
export function YearRanges({
  years,
  format,
  formatChange,
}: {
  years: YearRange[];
  /** Big readable value, e.g. 69.0¢. */
  format: (v: number) => string;
  formatChange: (pct: number) => string;
}) {
  const lo = Math.min(...years.map((y) => y.low));
  const hi = Math.max(...years.map((y) => y.high));
  const pad = (hi - lo) * 0.04;
  const min = lo - pad;
  const span = hi + pad - min || 1;
  const x = (v: number) => ((v - min) / span) * 100;
  const best = years.reduce((a, b) => (b.avg > a.avg ? b : a));
  const worst = years.reduce((a, b) => (b.avg < a.avg ? b : a));
  const ticks = Array.from({ length: 5 }, (_, i) => lo + ((hi - lo) * i) / 4);

  return (
    <div>
      <div className="hidden grid-cols-[3.5rem_1fr_7.5rem] gap-4 text-[11px] text-faint sm:grid">
        <span>Year</span>
        <span className="relative h-4">
          {ticks.map((t) => (
            <span key={t} className="absolute -translate-x-1/2" style={{ left: `${x(t)}%` }}>
              {format(t)}
            </span>
          ))}
        </span>
        <span className="text-right">Average · vs year before</span>
      </div>
      <ul className="mt-1">
        {years.map((y, i) => {
          const prev = years[i + 1];
          const chg = prev ? ((y.avg - prev.avg) / prev.avg) * 100 : undefined;
          const tag = y === best ? "Strongest" : y === worst ? "Weakest" : undefined;
          return (
            <li key={y.year} className="group grid grid-cols-[3.5rem_1fr_auto] items-center gap-4 rounded-xl py-2 transition-colors hover:bg-inset sm:grid-cols-[3.5rem_1fr_7.5rem]">
              <span className="pl-1 text-sm font-medium tabular-nums">
                {y.year}
                {y.partial && <span className="block text-[10px] font-normal text-faint">so far</span>}
              </span>
              <span className="relative h-8" title={`${y.year}: low ${format(y.low)}, high ${format(y.high)}, average ${format(y.avg)}`}>
                {ticks.map((t) => (
                  <span key={t} className="absolute inset-y-0 w-px bg-line" style={{ left: `${x(t)}%` }} aria-hidden="true" />
                ))}
                <span
                  className={`animate-grow-x absolute top-1/2 h-2.5 origin-left -translate-y-1/2 rounded-full ${
                    y === best ? "bg-bright" : y === worst ? "bg-bad-mark" : "bg-soft"
                  }`}
                  style={{ left: `${x(y.low)}%`, width: `${Math.max(x(y.high) - x(y.low), 1)}%`, animationDelay: `${i * 60}ms` }}
                />
                <span
                  className={`animate-fade absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card ${
                    y === worst ? "bg-bad-mark" : "bg-primary-mark"
                  }`}
                  style={{ left: `${x(y.avg)}%`, animationDelay: `${400 + i * 60}ms` }}
                />
                {tag && (
                  <span
                    className={`absolute -top-1.5 -translate-x-1/2 rounded-md px-1.5 text-[10px] font-semibold whitespace-nowrap ${
                      y === worst ? "bg-bad-tint text-bad" : "bg-primary-tint text-primary"
                    }`}
                    style={{ left: `${x(y.avg)}%` }}
                  >
                    {tag}
                  </span>
                )}
              </span>
              <span className="text-right">
                <span className="block text-sm font-semibold tabular-nums">{format(y.avg)}</span>
                {chg !== undefined && (
                  <span className={`block text-[11px] font-medium tabular-nums ${chg >= 0 ? "text-good" : "text-bad"}`}>
                    {chg >= 0 ? "▲" : "▼"} {formatChange(Math.abs(chg))}
                  </span>
                )}
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-6 rounded-full bg-soft" /> lowest to highest that year
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary-mark" /> yearly average
        </span>
      </div>
    </div>
  );
}

/* ------------------------------------------------------ YearsVsTarget ---- */

/**
 * One row per year against a target band: a bar from the year's low to its
 * high, a dot at the average coloured by where it landed, and a plain verdict.
 * The green band runs down every row so years line up against it.
 */
export function YearsVsTarget({
  years,
  band,
  format,
}: {
  years: YearRange[];
  band: [number, number];
  format: (v: number) => string;
}) {
  const lo = Math.min(0, ...years.map((y) => y.low));
  const hi = Math.max(band[1] + 1, ...years.map((y) => y.high));
  const min = Math.floor(lo);
  const max = Math.ceil(hi);
  const x = (v: number) => ((v - min) / (max - min)) * 100;
  const ticks = Array.from(new Set([min, 0, band[0], band[1], ...[5, 8, 10].filter((t) => t < max), max])).sort((a, b) => a - b);
  const verdict = (v: number) =>
    v > band[1]
      ? { text: "Above", dot: "bg-bad-mark", chip: "bg-bad-tint-strong text-bad" }
      : v < band[0]
        ? { text: "Below", dot: "bg-primary-mark", chip: "bg-primary-tint text-primary" }
        : { text: "On target", dot: "bg-good-mark", chip: "bg-good-tint text-good" };
  const counts = { above: 0, on: 0, below: 0 };
  for (const y of years) counts[y.avg > band[1] ? "above" : y.avg < band[0] ? "below" : "on"]++;

  return (
    <div>
      <p className="mb-5 text-sm text-muted">
        <strong className="font-semibold text-bad">{counts.above}</strong> {counts.above === 1 ? "year" : "years"} above target ·{" "}
        <strong className="font-semibold text-good">{counts.on}</strong> on target ·{" "}
        <strong className="font-semibold text-primary">{counts.below}</strong> below
      </p>
      <div className="grid grid-cols-[3rem_1fr_6.5rem] gap-3 text-[10px] text-faint sm:grid-cols-[3.5rem_1fr_8rem] sm:gap-4">
        <span />
        <span className="relative h-4">
          {ticks.map((t) => (
            <span
              key={t}
              className={`absolute tabular-nums ${t === min ? "" : t === max ? "-translate-x-full" : "-translate-x-1/2"}`}
              style={{ left: `${x(t)}%` }}
            >
              {format(t)}
            </span>
          ))}
        </span>
        <span className="text-right">Average</span>
      </div>
      <ul className="relative">
        {years.map((y, i) => {
          const v = verdict(y.avg);
          return (
            <li
              key={y.year}
              className="grid grid-cols-[3rem_1fr_6.5rem] items-center gap-3 rounded-xl py-1.5 transition-colors hover:bg-inset sm:grid-cols-[3.5rem_1fr_8rem] sm:gap-4"
              title={`${y.year}: average ${format(y.avg)}, low ${format(y.low)}, high ${format(y.high)}`}
            >
              <span className="pl-1 text-sm font-medium tabular-nums">
                {y.year}
                {y.partial && <span className="block text-[10px] leading-tight font-normal text-faint">so far</span>}
              </span>
              <span className="relative h-7">
                <span className="absolute inset-y-0 bg-good-tint" style={{ left: `${x(band[0])}%`, width: `${x(band[1]) - x(band[0])}%` }} />
                {min < 0 && <span className="absolute inset-y-0 w-px bg-line" style={{ left: `${x(0)}%` }} />}
                <span
                  className="animate-grow-x absolute top-1/2 h-1.5 origin-left -translate-y-1/2 rounded-full bg-soft"
                  style={{ left: `${x(y.low)}%`, width: `${Math.max(x(y.high) - x(y.low), 1)}%`, animationDelay: `${i * 50}ms` }}
                />
                <span
                  className={`animate-fade absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ring-[3px] ring-card ${v.dot}`}
                  style={{ left: `${x(y.avg)}%`, animationDelay: `${350 + i * 50}ms` }}
                />
              </span>
              <span className="flex items-center justify-end gap-2">
                <span className="text-sm font-semibold tabular-nums">{format(y.avg)}</span>
                <span className={`w-[4.25rem] rounded-full py-0.5 text-center text-[10px] font-semibold ${v.chip}`}>{v.text}</span>
              </span>
            </li>
          );
        })}
      </ul>
      <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-2 text-xs text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-3 w-4 rounded-sm bg-good-tint" /> 2–3% target
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-1.5 w-6 rounded-full bg-soft" /> lowest to highest that year
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-3 rounded-full bg-primary-mark ring-[3px] ring-card" /> yearly average
        </span>
      </div>
    </div>
  );
}

/* -------------------------------------------------------- PriceBridge ---- */

/**
 * A price bridge (waterfall) on one zoomed price scale: last year's price,
 * then each cause as a floating step down (red) or up (green) from the running
 * total, landing on today's price. Steps float, so the zoomed scale is honest.
 */
export function PriceBridge({
  from,
  to,
  causes,
  format,
}: {
  from: { label: string; value: number };
  to: { label: string; value: number };
  causes: { label: string; value: number; note: string }[];
  format: (v: number) => string;
}) {
  const total = to.value - from.value;
  const pct = (total / from.value) * 100;
  const money = (v: number) => `${v >= 0 ? "+" : "−"}${format(Math.abs(v))}`;

  // Running total after each cause.
  const steps: { label: string; value: number; note: string; start: number; end: number }[] = [];
  let run = from.value;
  for (const c of causes) {
    steps.push({ ...c, start: run, end: run + c.value });
    run += c.value;
  }
  const levels = [from.value, to.value, ...steps.flatMap((st) => [st.start, st.end])];
  const lo0 = Math.min(...levels);
  const hi0 = Math.max(...levels);
  const pad = (hi0 - lo0 || Math.abs(hi0) * 0.02 || 1) * 0.18;
  // A few round ticks across the zoomed range.
  const raw = (hi0 - lo0 + 2 * pad) / 2.5;
  const mag = 10 ** Math.floor(Math.log10(raw || 1));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((x) => x >= raw) ?? 10 * mag;
  const lo = Math.floor((lo0 - pad) / step) * step;
  const hi = Math.ceil((hi0 + pad) / step) * step;
  const ticks: number[] = [];
  for (let v = lo; v <= hi + step / 2; v += step) ticks.push(Number(v.toPrecision(10)));
  const x = (v: number) => ((v - lo) / (hi - lo || 1)) * 100;
  // Axis labels without trailing zero cents ("A$190", not "A$190.00").
  const tickText = (t: number) => format(t).replace(/\.0+(?=\D*$)/, "");

  // The biggest cause, for the one-line answer.
  const main = [...steps].sort((p, q) => Math.abs(q.value) - Math.abs(p.value))[0];
  const rows: { kind: "level" | "step"; label: string; sub?: string; value: number; start: number; end: number; now?: boolean }[] = [
    { kind: "level", label: from.label, value: from.value, start: from.value, end: from.value },
    ...steps.map((st) => ({ kind: "step" as const, label: st.label, sub: st.note, value: st.value, start: st.start, end: st.end })),
    { kind: "level", label: to.label, value: to.value, start: to.value, end: to.value, now: true },
  ];

  return (
    <div>
      {/* the answer first */}
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="flex flex-wrap items-baseline gap-x-2">
          <span className={`text-[28px] leading-none font-semibold tracking-tight tabular-nums ${total < 0 ? "text-bad" : "text-good"}`}>{money(total)}</span>
          <span className="text-sm text-muted">a gram</span>
          <span className={`rounded-full px-2 py-0.5 text-xs font-semibold tabular-nums ${total < 0 ? "bg-bad-tint text-bad" : "bg-good-tint-strong text-good"}`}>
            {pct >= 0 ? "+" : "−"}
            {Math.abs(pct).toFixed(1)}%
          </span>
        </p>
        {main && (
          <p className="text-sm text-muted">
            Biggest factor: <span className="font-medium text-ink">{main.label}</span>
          </p>
        )}
      </div>

      <p className="mt-4 text-xs leading-5 text-faint">Start at last year&apos;s price, then apply each effect in turn. Each arrow ends at the new price.</p>

      {/* the bridge: label and amount on top, the step on the shared price scale below */}
      <div className="mt-3" role="img" aria-label={`From ${format(from.value)} to ${format(to.value)}: ${steps.map((st) => `${st.label} ${money(st.value)}`).join(", ")}`}>
        <ol aria-hidden="true">
          {rows.map((r, i) => {
            const left = Math.min(r.start, r.end);
            const width = Math.abs(r.end - r.start);
            const up = r.value >= 0;
            return (
              <li key={r.label} className="relative py-2">

                <div className="flex items-center justify-between gap-3">
                  <p className="flex min-w-0 items-center gap-2 text-[15px] leading-snug font-medium text-ink">
                    {/* the sum, down the left: start, −, +, = */}
                    <span
                      className={`grid size-5 shrink-0 place-items-center rounded-full text-xs leading-none font-semibold ${
                        r.kind === "step" ? (up ? "bg-good-tint-strong text-good" : "bg-bad-tint text-bad") : r.now ? "bg-primary-tint text-primary" : "bg-chip text-muted"
                      }`}
                    >
                      {r.kind === "step" ? (up ? "+" : "−") : r.now ? "=" : "•"}
                    </span>
                    {/* "12 months ago · 10 Nov 2025": the words carry the row, the date sits back */}
                    <span className="min-w-0">
                      {r.label.split(" · ")[0]}
                      {r.label.includes(" · ") && <span className="font-normal text-muted"> · {r.label.split(" · ").slice(1).join(" · ")}</span>}
                    </span>
                  </p>
                  <p
                    className={`shrink-0 text-[15px] leading-snug tabular-nums ${
                      r.kind === "step" ? (up ? "font-medium text-good" : "font-medium text-bad") : r.now ? "font-semibold text-ink" : "font-medium text-ink"
                    }`}
                  >
                    {r.kind === "step" ? money(r.value) : format(r.value)}
                  </p>
                </div>
                {r.sub && <p className="mt-0.5 pl-7 text-xs leading-5 text-faint">{r.sub}</p>}
                <div className="relative mt-2 h-6">
                  {/* faint full-width track, so every row reads on the same price scale */}
                  <span className="absolute inset-x-0 top-1/2 h-px bg-line" />
                  {r.kind === "step" ? (
                    <>
                      {/* where this step starts: the price the row above ended on */}
                      <span className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-faint bg-card" style={{ left: `${x(r.start)}%` }} />
                      {/* the step as an arrow pointing the way the price moved */}
                      <span
                        className={`animate-grow-x absolute top-1/2 h-4 -translate-y-1/2 ${up ? "origin-left bg-good-mark" : "origin-right bg-bad-mark"}`}
                        style={{
                          left: `${x(left)}%`,
                          width: `max(${(width / (hi - lo || 1)) * 100}%, 12px)`,
                          clipPath: up ? "polygon(0 0, calc(100% - 8px) 0, 100% 50%, calc(100% - 8px) 100%, 0 100%)" : "polygon(8px 0, 100% 0, 100% 100%, 8px 100%, 0 50%)",
                          animationDelay: `${150 + i * 150}ms`,
                        }}
                        title={`${r.label}: ${money(r.value)}`}
                      />
                      {/* the new price, at the arrow's tip */}
                      <span
                        className={`absolute top-1/2 -translate-y-1/2 text-xs font-normal whitespace-nowrap text-muted tabular-nums ${up ? "pl-2" : "-translate-x-full pr-2"}`}
                        style={{ left: `calc(${x(r.end)}%${up ? (width / (hi - lo || 1)) * 100 < 2 ? " + 12px" : "" : ""})` }}
                      >
                        {format(r.end)}
                      </span>
                    </>
                  ) : (
                    <span
                      className={`absolute top-1/2 z-10 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full ${r.now ? "bg-primary-mark ring-4 ring-primary-mark/20" : "border-2 border-faint bg-card"}`}
                      style={{ left: `${x(r.value)}%` }}
                      title={`${r.label}: ${format(r.value)}`}
                    />
                  )}
                </div>
              </li>
            );
          })}
        </ol>
        {/* price axis (zoomed: the steps float, nothing starts from zero) */}
        <div className="relative mt-1.5 h-4 text-[11px] text-faint tabular-nums" aria-hidden="true">
          {ticks.map((t, i) => (
            <span key={t} className={`absolute ${i === 0 ? "" : i === ticks.length - 1 ? "-translate-x-full" : "-translate-x-1/2"}`} style={{ left: `${x(t)}%` }}>
              {tickText(t)}
            </span>
          ))}
        </div>
      </div>

      {/* the same thing as a sum */}
      <p className="mt-5 flex flex-wrap items-baseline gap-x-2 gap-y-1 border-t border-line pt-4 text-[15px] leading-snug text-muted tabular-nums">
        <span className="font-medium text-ink">{format(from.value)}</span>
        {steps.map((st) => (
          <span key={st.label} className={`font-medium ${st.value < 0 ? "text-bad" : "text-good"}`}>
            {st.value < 0 ? "−" : "+"} {format(Math.abs(st.value))}
          </span>
        ))}
        <span>=</span>
        <span className="font-semibold text-ink">{format(to.value)}</span>
        <span className="text-[13px] text-faint">today</span>
      </p>
    </div>
  );
}

/* -------------------------------------------------- InvestmentGrowth ---- */

/**
 * What a fixed amount became: each bar shows the money paid in a light shade
 * and the gain in a strong one (or the loss in rose), with the multiple and
 * the yearly return.
 */
export function InvestmentGrowth({
  paid,
  items,
  format,
}: {
  paid: number;
  items: { label: string; years: number; value: number }[];
  format: (v: number) => string;
}) {
  // Oldest purchase on the right, so the columns read like a timeline toward today.
  const cols = [...items].sort((x, y) => x.years - y.years);
  const max = Math.max(paid, ...cols.map((c) => c.value)) * 1.08;
  const h = (v: number) => (v / max) * 100;
  const best = cols.reduce((x, y) => (y.value > x.value ? y : x), cols[0]);

  return (
    <div>
      {best && (
        <p className="text-sm text-muted">
          Best: <span className="font-semibold text-ink">{best.label.toLowerCase()}</span>, now worth{" "}
          <span className="font-bold text-ink tabular-nums">{format(best.value)}</span>{" "}
          <span className="rounded-full bg-good-tint-strong px-2 py-0.5 text-[11px] font-bold text-good tabular-nums">
            {(best.value / paid).toFixed(1)}×
          </span>
        </p>
      )}

      {/* Columns: grey up to what you paid, blue for the gain above it, red if it lost value */}
      <div className="relative mt-10 h-52" aria-hidden="true">
        <div className="relative grid h-full grid-cols-4 items-end gap-3 sm:gap-5">
          {cols.map((c, i) => {
            const up = c.value >= paid;
            return (
              <div key={c.label} className="relative flex h-full flex-col justify-end">
                <span
                  className="absolute left-1/2 -translate-x-1/2 text-sm font-bold whitespace-nowrap tabular-nums"
                  style={{ bottom: `calc(${h(c.value)}% + 6px)` }}
                >
                  {format(c.value)}
                </span>
                <div
                  className="animate-grow-y relative w-full origin-bottom overflow-hidden rounded-t-[10px] rounded-b-[4px]"
                  style={{ height: `${h(c.value)}%`, animationDelay: `${150 + i * 90}ms` }}
                >
                  {up ? (
                    <>
                      <div className="absolute inset-x-0 top-0 bg-good-mark" style={{ height: `${((c.value - paid) / c.value) * 100}%` }} />
                      <div className="absolute inset-x-0 bottom-0 bg-soft" style={{ height: `${(paid / c.value) * 100}%` }} />
                    </>
                  ) : (
                    <div className="absolute inset-0 bg-bad-mark" />
                  )}
                </div>
              </div>
            );
          })}
        </div>
        {/* What you paid, as a dashed line drawn over the columns */}
        <div className="pointer-events-none absolute inset-x-0 border-t-2 border-dashed border-ink/40" style={{ bottom: `${h(paid)}%` }} />
      </div>

      {/* Labels under each column */}
      <div className="mt-3 grid grid-cols-4 gap-3 border-t border-line pt-3 sm:gap-5">
        {cols.map((c) => {
          const yearly = ((c.value / paid) ** (1 / c.years) - 1) * 100;
          return (
            <div key={c.label} className="text-center">
              <p className="text-xs font-semibold whitespace-nowrap text-ink">
                {c.years} {c.years === 1 ? "yr" : "yrs"}
                <span className="max-sm:hidden"> ago</span>
              </p>
              <p className={`mt-1 text-[11px] font-bold tabular-nums ${yearly >= 0 ? "text-good" : "text-bad"}`}>
                {yearly >= 0 ? "+" : "−"}
                {Math.abs(yearly).toFixed(1)}%/yr
              </p>
            </div>
          );
        })}
      </div>

      <div className="mt-5 flex flex-wrap gap-x-4 gap-y-1 text-xs text-faint">
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-soft" /> what you paid
        </span>
        <span className="flex items-center gap-1.5">
          <span className="w-4 border-t-2 border-dashed border-ink/40" /> {format(paid)} line
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-good-mark" /> gain
        </span>
        <span className="flex items-center gap-1.5">
          <span className="size-2.5 rounded-[3px] bg-bad-mark" /> worth less than paid
        </span>
      </div>
    </div>
  );
}
/* -------------------------------------------------------- RateStairs ---- */

export type RateStep = { date: string; month: string; change: number; rate: number };

/**
 * Recent Board decisions, one slim column per meeting: raised in rose,
 * held in grey, cut in emerald; only the latest value is emphasised.
 */
export function RateStairs({ steps }: { steps: RateStep[] }) {
  const max = Math.max(...steps.map((s) => s.rate), 0.5);
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return (
    <div>
      <div className="flex h-64 items-end" role="img" aria-label="Cash rate set at each recent meeting">
        {steps.map((s, i) => {
          const last = i === steps.length - 1;
          const moved = s.change !== 0;
          return (
            <div
              key={s.date}
              className="group flex h-full min-w-0 flex-1 flex-col items-center justify-end"
              title={`${s.month}: ${moved ? `${s.change > 0 ? "raised" : "cut"} ${Math.round(Math.abs(s.change) * 100)} bp` : "held"} → ${s.rate.toFixed(2)}%`}
            >
              <span className={`text-[9px] leading-none ${s.change > 0 ? "text-bad" : "text-good"}`}>{moved ? (s.change > 0 ? "▲" : "▼") : "\u00a0"}</span>
              <span className={`mt-1 mb-1.5 text-[11px] tabular-nums ${last ? "font-semibold text-ink" : "text-faint group-hover:text-muted"}`}>
                {s.rate.toFixed(2)}
              </span>
              {/* capsule: rounded track, filled to the rate */}
              <div className={`relative h-[70%] w-3 overflow-hidden rounded-full bg-inset ${last ? "ring-2 ring-primary-mark ring-offset-2 ring-offset-card" : ""}`}>
                <div
                  className={`animate-grow-y absolute inset-x-0 bottom-0 origin-bottom rounded-full transition-opacity group-hover:opacity-80 ${s.change > 0 ? "bg-bad-mark" : s.change < 0 ? "bg-good-mark" : "bg-soft"}`}
                  style={{ height: `${(s.rate / max) * 100}%`, animationDelay: `${i * 40}ms` }}
                />
              </div>
            </div>
          );
        })}
      </div>
      <div className="flex border-t border-line pt-2">
        {steps.map((s, i) => {
          const year = s.date.slice(0, 4);
          const showYear = i === 0 || steps[i - 1].date.slice(0, 4) !== year;
          return (
            <div key={s.date} className="min-w-0 flex-1 text-center text-[10px] leading-tight text-faint">
              <span className="block">{months[Number(s.date.slice(5, 7)) - 1]}</span>
              <span className="block h-3 text-muted">{showYear ? year : ""}</span>
            </div>
          );
        })}
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-faint">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2 rounded-sm bg-bad-mark" /> raised
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2 rounded-sm bg-soft" /> held
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2 rounded-sm bg-good-mark" /> cut
        </span>
      </div>
    </div>
  );
}

/* --------------------------------------------------------- StepSpark ---- */

/** A small staircase line of a rate over a window, with each change marked. */
export function StepSpark({ points, height = 64 }: { points: { date: string; value: number }[]; height?: number }) {
  if (points.length < 2) return null;
  const t0 = Date.parse(points[0].date);
  const tN = Date.parse(points[points.length - 1].date) - t0 || 1;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const x = (d: string) => ((Date.parse(d) - t0) / tN) * 100;
  const y = (v: number) => 10 + (1 - (v - lo) / span) * 80;
  let d = `M0,${y(points[0].value)}`;
  for (let i = 1; i < points.length; i++) d += `H${x(points[i].date)}V${y(points[i].value)}`;
  const changes = points.slice(1).filter((p, i) => p.value !== points[i].value);

  return (
    <div className="relative" style={{ height }}>
      <svg viewBox="0 0 100 100" preserveAspectRatio="none" className="absolute inset-0 size-full overflow-visible" aria-hidden="true">
        <path d={`${d}V100H0Z`} fill="var(--color-primary)" fillOpacity="0.07" />
        <path d={d} fill="none" stroke="var(--color-primary)" strokeWidth="2" vectorEffect="non-scaling-stroke" strokeLinejoin="round" />
      </svg>
      {changes.map((p) => (
        <span
          key={p.date}
          className="absolute size-2 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-bad"
          style={{ left: `${x(p.date)}%`, top: `${y(p.value)}%` }}
        />
      ))}
    </div>
  );
}

/* --------------------------------------------------- MeetingTimeline ---- */

/** Today and the next Board meetings placed by date on one track. */
export function MeetingTimeline({ today, meetings, label }: { today: string; meetings: string[]; label: (d: string) => string }) {
  if (!meetings.length) return null;
  const t0 = Date.parse(today);
  const tN = Date.parse(meetings[meetings.length - 1]) - t0 || 1;
  const x = (d: string) => 4 + ((Date.parse(d) - t0) / tN) * 92;
  return (
    <div className="relative mt-2 h-16" aria-label="Upcoming meetings">
      <span className="absolute top-3 right-[4%] left-[4%] h-0.5 rounded-full bg-line" />
      <span className="absolute top-3 left-[4%] h-0.5 rounded-full bg-primary" style={{ width: `${x(meetings[0]) - 4}%` }} />
      <span className="absolute top-3 left-[4%] size-3 -translate-x-1/2 -translate-y-1/2 rounded-full bg-ink ring-4 ring-card" />
      <span className="absolute top-6 left-[4%] -translate-x-1/2 text-[10px] font-semibold">Today</span>
      {meetings.map((m, i) => (
        <span key={m} className="absolute top-3" style={{ left: `${x(m)}%` }}>
          <span
            className={`absolute size-3 -translate-x-1/2 -translate-y-1/2 rounded-full ring-4 ring-card ${i === 0 ? "bg-primary" : "border-2 border-faint bg-card"}`}
          />
          <span className={`absolute top-3 -translate-x-1/2 text-[10px] whitespace-nowrap ${i === 0 ? "font-semibold text-primary" : "text-faint"}`}>
            {label(m)}
          </span>
        </span>
      ))}
    </div>
  );
}
