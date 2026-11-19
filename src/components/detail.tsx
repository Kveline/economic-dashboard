import type { ReactNode } from "react";
import { toneFor, type IndicatorMeta, type Snapshot, type Tone } from "@/lib/data/indicators";
import { fmtMonth, fmtPeriod, formatSigned, formatUnsigned, formatValue, valueParts } from "@/lib/format";
import { windowStats, type Point } from "@/lib/series";
import type { Status } from "@/lib/status";
import { changeLabel } from "@/lib/view";
import { BigValue, ChangeLine, StatusLine, Tile } from "./home";
import { BackPill, DetailHeading, LivePill, Shell } from "./Shell";
import { Sources } from "./Sources";
import { buildInsights, type Insight, type InsightIcon } from "@/lib/insights";
import { FactsPanel } from "./Facts";
import { Card, Unavailable } from "./ui";

/**
 * Detail page frame: the same canvas and pale-blue top band as the main page,
 * with the indicator's name and a plain-English explanation as the hero.
 * Each direct child row rises in, one after another.
 */
export function DetailPage({
  meta,
  children,
  className = "",
}: {
  meta: IndicatorMeta;
  children: ReactNode;
  /** Extra class on the page. Calm type (`type-calm`) and the type scale (`type-v2`) are always on. */
  className?: string;
}) {
  return (
    <div className={`type-calm type-v2 ${className}`}>
    <Shell
      topLeft={<BackPill />}
      topRight={<LivePill />}
      compact
      hero={<DetailHeading tile={<Tile indicator={meta.key} size="lg" round />} group={meta.group} title={meta.name} lead={meta.explainer} />}
    >
      <div className="stagger space-y-3 sm:space-y-4">{children}</div>
      <Sources ids={meta.sources} note="Official figures, refreshed every few hours" />
    </Shell>
    </div>
  );
}

export function DetailUnavailable({ meta, error }: { meta: IndicatorMeta; error: string }) {
  return (
    <DetailPage meta={meta}>
      <Card className="min-h-48">
        <Unavailable title={meta.name} error={error} />
      </Card>
    </DetailPage>
  );
}

/** Latest value card: big number with the unit in blue, status, change, date. */
export function Headline({
  meta,
  snap,
  note,
  dateLine,
  status,
  series,
  changeText,
  facts = "tiles",
}: {
  /** "combined" swaps the six text tiles for three tiles with small visuals (see Facts.tsx). */
  facts?: "tiles" | "combined";
  meta: IndicatorMeta;
  snap: Snapshot;
  /** Small grey line under the number, e.g. "per gram". */
  note?: string;
  dateLine?: ReactNode;
  status?: Status;
  /** Full history, for the key-facts grid beside the number. */
  series?: Point[];
  /** Overrides the "vs prev …" text beside the change. */
  changeText?: string;
}) {
  const parts = valueParts(meta.format);
  const period = fmtPeriod(snap.current.date, meta.frequency);
  const insights = series ? buildInsights(meta, series) : [];
  return (
    <Card className={`grid gap-4 p-3 sm:p-4 lg:gap-5 ${insights.length ? "lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)]" : ""}`}>
      {/* left: the number, on a soft panel */}
      <div className="flex flex-col rounded-[18px] bg-inset p-5 sm:p-6">
        <span className="inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs text-muted shadow-card">
          <span className="size-1.5 rounded-full bg-primary-mark" aria-hidden="true" />
          <span>
            Latest · <span className="text-ink">{period}</span>
          </span>
        </span>
        <BigValue value={snap.current.value} digits={parts.digits} prefix={parts.prefix} suffix={parts.suffix} size="xl" accent />
        {note && <p className="mt-2 text-xs text-muted">{note}</p>}
        {status && (
          <p className="mt-4">
            <StatusLine tone={status.tone} icon={status.icon}>
              {status.text}
            </StatusLine>
          </p>
        )}
        <div className="mt-3 w-fit rounded-full bg-card px-3 py-1 shadow-card [&>p]:mt-0">
          <ChangeLine value={snap.change} unit={meta.changeUnit} tone={snap.tone !== "neutral" || snap.change === undefined || Number(snap.change.toFixed(2)) === 0 ? snap.tone : snap.change > 0 ? "good" : "bad"} label={changeText ?? changeLabel(meta, snap.current, snap.previous)} />
        </div>
        <p className="mt-auto flex items-center gap-1.5 pt-6 text-xs text-faint">
          <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
            <circle cx="8" cy="8" r="6.25" />
            <path d="M8 4.75V8l2.25 1.5" />
          </svg>
          {dateLine ?? period}
        </p>
      </div>

      {/* right: key facts the chart doesn't spell out */}
      {insights.length > 0 && (facts === "combined" && series ? <FactsPanel meta={meta} series={series} /> : <InsightGrid insights={insights} />)}
    </Card>
  );
}

/** Tone lives in the small icon disc, so the values themselves stay calm ink. */
const insightTone: Record<Tone, string> = {
  good: "bg-good-tint-strong text-good",
  bad: "bg-bad-tint-strong text-bad",
  neutral: "bg-inset text-muted",
};
const insightWord: Record<Tone, string> = { good: "good sign", bad: "watch", neutral: "" };

const insightGlyph: Record<InsightIcon, ReactNode> = {
  calendar: <path d="M3 4.5h10v8.5H3zM3 7.5h10M6 3v3M10 3v3" />,
  history: <path d="M3.5 8a4.5 4.5 0 1 0 1.3-3.2M3.5 3v2.2h2.2M8 5.5V8l1.8 1.2" />,
  average: <path d="M2.5 8h11M2.5 11.5c2-3 3.5-6 5.5-6s3.5 3 5.5 6" />,
  record: <path d="M8 2.5l1.6 3.3 3.6.5-2.6 2.5.6 3.6L8 10.7l-3.2 1.7.6-3.6-2.6-2.5 3.6-.5z" />,
  rank: <path d="M3 13V9M6.3 13V6M9.7 13V8M13 13V3.5" />,
  streak: <path d="M2.5 11.5l4-4 2.5 2.5 4.5-5M10 5h3.5v3.5" />,
  streakDown: <path d="M2.5 4.5l4 4 2.5-2.5 4.5 5M10 11h3.5V7.5" />,
};

/**
 * Key facts as an open grid divided by hairlines: no boxes, lots of air.
 * Tone shows in the icon disc (emerald/rose/slate); values stay in ink.
 * The negative margins hide the outer hairlines so only inner ones show.
 */
export function InsightGrid({ insights }: { insights: Insight[] }) {
  return (
    <ul className="grid grid-cols-2 gap-2 self-center sm:grid-cols-3 sm:gap-2.5">
      {insights.map((it, i) => (
        <li
          key={it.label}
          className="animate-fade flex flex-col rounded-[16px] bg-inset p-3.5 transition-colors duration-300 hover:bg-chip sm:p-5"
          style={{ animationDelay: `${i * 60}ms` }}
        >
          <div className="flex items-center justify-between gap-2">
            <p className="text-xs text-muted">{it.label}</p>
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full ${it.tone === "neutral" ? "bg-card text-muted shadow-card" : insightTone[it.tone]}`}
              title={insightWord[it.tone] || undefined}
            >
              {insightWord[it.tone] && <span className="sr-only">{insightWord[it.tone]}</span>}
              <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                {insightGlyph[it.icon]}
              </svg>
            </span>
          </div>
          <p className="mt-3 text-[18px] leading-snug font-medium tracking-tight text-ink tabular-nums">{it.value}</p>
          {it.meter !== undefined && (
            <span className="relative mt-3 block h-1 rounded-full bg-chip" aria-hidden="true">
              <span className="absolute inset-y-0 left-0 rounded-full bg-soft" style={{ width: `${it.meter * 100}%` }} />
              <span
                className="absolute top-1/2 size-2.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 border-card bg-primary-mark"
                style={{ left: `${it.meter * 100}%` }}
              />
            </span>
          )}
          <p className="mt-1 text-xs leading-5 text-faint">{it.detail}</p>
        </li>
      ))}
    </ul>
  );
}

/** "Past 12 months" grid. `full` adds largest/typical move (for monthly rates). */
export function PastYearStats({
  meta,
  points,
  full = false,
  range = true,
}: {
  meta: IndicatorMeta;
  points: Point[];
  full?: boolean;
  /** Show the low–high strip under the bars. Off where the page shows the range elsewhere. */
  range?: boolean;
}) {
  const s = windowStats(points);
  if (!s || points.length < 2) return null;
  const label = (d: string) => fmtPeriod(d, meta.frequency);
  const fmt = (v: number) => formatValue(v, meta.format);
  const pct = meta.changeUnit === "%";
  const net = pct ? ((s.last.value - s.first.value) / s.first.value) * 100 : s.last.value - s.first.value;
  const netTone = toneFor(meta.polarity === "neutral" ? "up-good" : meta.polarity, net);
  const netPill = { good: "bg-good-tint text-good", bad: "bg-bad-tint text-bad", neutral: "bg-chip text-muted" }[netTone];

  // Mini chart geometry (percent space so HTML dots stay round).
  const lo = s.low.value;
  const hi = s.high.value;
  const span = hi - lo || 1;
  const rx = (v: number) => ((v - lo) / span) * 100;
  // When today ties the high or low, show one marker and one label, not two.
  const nowIsHigh = s.last.value === hi && hi !== lo;
  const nowIsLow = s.last.value === lo && hi !== lo;
  const nowTag = nowIsHigh ? `Now · 12-month high ${fmt(hi)}` : nowIsLow ? `Now · 12-month low ${fmt(lo)}` : undefined;

  return (
    <Card className="flex flex-col">
      <div className="flex items-start justify-between gap-3">
        <div>
          <h2 className="text-[20px] font-medium tracking-tight">Past 12 months</h2>
          <p className="mt-0.5 text-xs text-faint">since {label(s.first.date)}</p>
        </div>
        <span className={`rounded-full px-2.5 py-1 text-xs font-semibold tabular-nums ${netPill}`}>
          {formatSigned(net, pct ? "%" : "pp")} net
        </span>
      </div>

      {/* month by month: how much it moved each month (momentum, not another line) */}
      <MonthlyMoves meta={meta} points={points} />

      {/* range strip: where the average and today sit between low and high */}
      {range && (
      <div className="pt-8">
        <div className="mb-4 flex items-baseline justify-between gap-4 text-xs">
          <span className="font-medium text-ink">12-month range</span>
          <span className="flex items-center gap-1.5 text-muted">
            <span className="h-3 w-px bg-faint" aria-hidden="true" />
            average <span className="font-medium text-ink tabular-nums">{fmt(s.mean)}</span>
          </span>
        </div>
        <div className="relative h-1.5 rounded-full bg-chip">
          <span className="absolute -top-1.5 -bottom-1.5 w-px bg-faint" style={{ left: `${rx(s.mean)}%` }} />
          <span
            className="absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-primary-mark"
            style={{ left: `${rx(s.last.value)}%` }}
          />
        </div>
        <div className={`mt-3 grid text-xs ${nowTag ? "grid-cols-2" : "grid-cols-3"}`}>
          <span>
            <span className={`block font-medium tabular-nums ${nowIsLow ? "text-primary" : ""}`}>{fmt(lo)}</span>
            <span className="text-faint">{nowIsLow ? `now · same as the low (${label(s.low.date)})` : `low · ${label(s.low.date)}`}</span>
          </span>
          {!nowTag && (
            <span className="text-center">
              <span className="block font-medium tabular-nums text-primary">{fmt(s.last.value)}</span>
              <span className="text-faint">now</span>
            </span>
          )}
          <span className="text-right">
            <span className={`block font-medium tabular-nums ${nowIsHigh ? "text-primary" : ""}`}>{fmt(hi)}</span>
            <span className="text-faint">{nowIsHigh ? `now · same as the high (${label(s.high.date)})` : `high · ${label(s.high.date)}`}</span>
          </span>
        </div>
      </div>
      )}

      {full && (s.largestMove || s.typicalMove !== undefined) && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-line pt-4 text-xs">
          {s.largestMove && (
            <span className="rounded-full bg-inset px-3 py-1.5 text-muted">
              Biggest monthly move <strong className="font-semibold text-ink">{formatUnsigned(s.largestMove.value, "pp")}</strong> · {label(s.largestMove.date)}
            </span>
          )}
          {s.typicalMove !== undefined && (
            <span className="rounded-full bg-inset px-3 py-1.5 text-muted">
              Typical month <strong className="font-semibold text-ink">±{formatUnsigned(s.typicalMove, "pp")}</strong>
            </span>
          )}
        </div>
      )}
    </Card>
  );
}

/**
 * Month-end values → change each month, as slim bars above/below a zero line.
 * Quiet by design: only the best month, the worst month and the latest carry
 * a number (the rest show theirs on hover); the latest month's label is bold.
 */
function MonthlyMoves({ meta, points }: { meta: IndicatorMeta; points: Point[] }) {
  const ends = new Map<string, Point>();
  for (const p of points) ends.set(p.date.slice(0, 7), p);
  const months = [...ends.values()];
  const pct = meta.changeUnit === "%";
  const moves = months.slice(1).map((p, i) => {
    const prev = months[i].value;
    return { date: p.date, change: pct ? (p.value / prev - 1) * 100 : p.value - prev };
  });
  if (moves.length < 2) return null;
  const max = Math.max(...moves.map((m) => Math.abs(m.change)), 0.01);
  const ups = moves.filter((m) => m.change > 0.0001).length;
  const downs = moves.filter((m) => m.change < -0.0001).length;
  const unit = pct ? "%" : "pp";
  const lastIdx = moves.length - 1;
  const best = moves.reduce((a, b, i) => (b.change > moves[a].change ? i : a), 0);
  const worst = moves.reduce((a, b, i) => (b.change < moves[a].change ? i : a), 0);
  const labelled = new Set([lastIdx, best, worst]);
  const upIsGood = (c: number) => {
    const tone = toneFor(meta.polarity, c);
    return tone === "neutral" ? c >= 0 : tone === "good";
  };

  return (
    <div className="mt-7 flex flex-1 flex-col">
      <div className="mb-2 flex items-baseline justify-between gap-4 text-xs">
        <span className="font-medium text-ink">Change each month</span>
        <span className="text-muted">
          up in <strong className="font-semibold text-ink">{ups}</strong> · down in <strong className="font-semibold text-ink">{downs}</strong> of {moves.length}
        </span>
      </div>
      <div className="relative min-h-44 flex-1" role="img" aria-label={`Up in ${ups} of ${moves.length} months`}>
        <span className="absolute inset-x-0 top-1/2 h-px bg-line" aria-hidden="true" />
        <div className="absolute inset-0 flex">
          {moves.map((m, i) => {
            // Bars reach at most 36% of the height each way, leaving room for the numbers.
            const h = (Math.abs(m.change) / max) * 36;
            const up = m.change >= 0;
            const flat = Math.abs(m.change) < 1e-4;
            const text = formatSigned(m.change, unit);
            return (
              <div key={m.date} className="group relative flex-1" title={`${fmtMonth(m.date)}: ${text}`}>
                <div
                  className={`animate-grow-y absolute left-1/2 w-[46%] max-w-4 min-w-1.5 -translate-x-1/2 rounded-full ${up ? "bottom-1/2 origin-bottom" : "top-1/2 origin-top"} ${
                    flat ? "bg-soft" : upIsGood(m.change) ? "bg-good-mark" : "bg-bad-mark"
                  }`}
                  style={{ height: `${Math.max(h, 2)}%`, animationDelay: `${i * 35}ms` }}
                />
                <span
                  className={`pointer-events-none absolute left-1/2 -translate-x-1/2 text-[11px] whitespace-nowrap tabular-nums ${
                    labelled.has(i) ? (i === lastIdx ? "font-semibold text-ink" : "text-muted") : "hidden text-ink group-hover:block"
                  }`}
                  style={up ? { bottom: `calc(${50 + h}% + 6px)` } : { top: `calc(${50 + h}% + 6px)` }}
                >
                  {text}
                </span>
              </div>
            );
          })}
        </div>
      </div>
      <div className="mt-1 flex text-center text-[11px] text-faint">
        {moves.map((m, i) => {
          const name = fmtMonth(m.date).slice(0, 3);
          return (
            <span key={m.date} className={`flex-1 ${i === lastIdx ? "font-semibold text-ink" : ""}`}>
              <span className="sm:hidden">{name[0]}</span>
              <span className="hidden sm:inline">{name}</span>
            </span>
          );
        })}
      </div>
    </div>
  );
}
