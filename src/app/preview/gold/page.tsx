// Preview: the gold page remade after a reference dashboard. Delete src/app/preview/gold to remove it.

import type { Metadata } from "next";
import Link from "next/link";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { DetailUnavailable } from "@/components/detail";
import { Sources } from "@/components/Sources";
import { ThemeToggle } from "@/components/ThemeToggle";
import { GRAMS_PER_TROY_OUNCE } from "@/lib/data/gold";
import { getGold, getToday, META, snapshot } from "@/lib/data/indicators";
import { fmtDay, fmtDayLong, fmtMonth, formatSigned, formatUnsigned } from "@/lib/format";
import { buildInsights } from "@/lib/insights";
import { addMonths, addYears, daysBetween, indexAt, valueAt, windowStats, type Point } from "@/lib/series";
import { buildRanges, changeLabel, pastYear } from "@/lib/view";
import { PriceBars, PriceHero, StandRowItem, type Bar, type BarMode, type StandRow, type UnitView } from "./client";
import { Chip, Glyph, Panel, PanelHead, Pill, type GlyphName } from "./parts";

export const metadata: Metadata = { title: "Gold price (preview) · Simple Metrics Dashboard", robots: { index: false } };

/*
 * Page-scoped colours: a light grey page, an off-white canvas, green for up,
 * red for down and one neon-blue highlight (the marked bar, progress bars,
 * the feature card, "now" markers). Text colours come from the app's
 * contrast-safe tokens (--color-good / --color-bad / --color-primary); the
 * brighter scoped hues are for marks only. Dark mode has its own tuned
 * values (deeper cards, softer glows), switched in by data-theme="dark" on <html>.
 * --cs is the layered card shadow: hairline, tight, wide and a top-edge highlight.
 */
const THEME = [
  "[--pg:#eceef8] [--cv:var(--color-page)]",
  "[--cs:0_0_0_1px_rgb(15_23_42/0.04),0_1px_2px_rgb(15_23_42/0.05),0_12px_32px_-12px_rgb(15_23_42/0.12),inset_0_1px_0_rgb(255_255_255/0.9)]",
  "[--cs-hover:0_0_0_1px_rgb(15_23_42/0.05),0_2px_4px_rgb(15_23_42/0.06),0_22px_44px_-14px_rgb(15_23_42/0.2),inset_0_1px_0_rgb(255_255_255/0.9)]",
  "[--up:var(--color-good-mark)] [--up-ink:var(--color-good)] [--down:var(--color-bad-mark)] [--down-ink:var(--color-bad)]",
  "[--hl:var(--color-bright)] [--hl-glow:#a9c6ff] [--glow:rgb(122_167_255/0.45)] [--bar:var(--color-inset)] [--bar-top:var(--color-chip)] [--bar-hot:var(--color-soft)]",
  "[--tip:var(--color-ink)] [--tip-ink:var(--color-canvas)] [--tip-mute:var(--color-soft)]",
  "[--feat-a:#dbe7ff] [--feat-m:#cfdfff] [--feat-b:#bcd4ff] in-data-[theme=dark]:[--feat-a:color-mix(in_srgb,#7aa7ff_14%,var(--color-card))] in-data-[theme=dark]:[--feat-m:color-mix(in_srgb,#7aa7ff_20%,var(--color-card))] in-data-[theme=dark]:[--feat-b:color-mix(in_srgb,#7aa7ff_28%,var(--color-card))]",
  "[--dk:#1e2235] [--dk2:#2c3150] [--dk-track:rgb(255_255_255/0.12)] [--dk-bar:var(--color-bright)] [--dk-mute:#a3adbf] [--cap-glow:0_0_12px_2px_rgb(122_167_255/0.6)]",
  "in-data-[theme=dark]:[--pg:var(--color-page)] in-data-[theme=dark]:[--cv:var(--color-canvas)]",
  "in-data-[theme=dark]:[--cs:inset_0_1px_0_rgb(255_255_255/0.06),inset_0_0_0_1px_rgb(255_255_255/0.06),0_1px_2px_rgb(0_0_0/0.3),0_12px_32px_-10px_rgb(0_0_0/0.55)]",
  "in-data-[theme=dark]:[--cs-hover:inset_0_1px_0_rgb(255_255_255/0.08),inset_0_0_0_1px_rgb(255_255_255/0.1),0_2px_4px_rgb(0_0_0/0.35),0_22px_44px_-12px_rgb(0_0_0/0.7)]",
  "in-data-[theme=dark]:[--hl-glow:#93c5fd] in-data-[theme=dark]:[--glow:rgb(122_167_255/0.3)] in-data-[theme=dark]:[--bar:#1e2330] in-data-[theme=dark]:[--bar-top:var(--color-line)] in-data-[theme=dark]:[--bar-hot:var(--color-soft)]",
  "in-data-[theme=dark]:[--dk:#1a1e27] in-data-[theme=dark]:[--dk2:var(--color-chip)] in-data-[theme=dark]:[--dk-mute:var(--color-muted)] in-data-[theme=dark]:[--cap-glow:0_0_8px_1px_rgb(122_167_255/0.4)]",
].join(" ");

const MON = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const money2 = (v: number) => `A$${v.toFixed(2)}`;
const signedMoney = (v: number) => `${v >= 0 ? "+" : "−"}A$${Math.abs(v).toFixed(2)}`;
const mean = (xs: number[]) => xs.reduce((s, x) => s + x, 0) / xs.length;

/** Gridline values from 0 to a round top a little above `max`, at most 5 steps. */
function ticks(max: number): number[] {
  const step = [5, 10, 20, 25, 50, 100, 200, 250, 500, 1000].find((s) => Math.ceil((max * 1.05) / s) <= 5) ?? 1000;
  const top = Math.ceil((max * 1.05) / step) * step;
  return Array.from({ length: top / step + 1 }, (_, i) => i * step);
}

/** "No stored prices for Mar 2026 to Oct 2026." from the bars that have no value. */
function gapNote(bars: Bar[], unit: string): string | undefined {
  const runs: Bar[][] = [];
  bars.forEach((b, i) => {
    if (b.value !== undefined) return;
    if (i > 0 && bars[i - 1].value === undefined) runs[runs.length - 1].push(b);
    else runs.push([b]);
  });
  if (!runs.length) return undefined;
  const parts = runs.map((r) => (r.length === 1 ? r[0].title : `${r[0].title} to ${r[r.length - 1].title}`));
  return `No stored ${unit} prices for ${parts.join(", ")}, so those slots are empty.`;
}

export default async function GoldPreview() {
  const meta = META.gold;
  const [result, today] = await Promise.all([getGold(), getToday()]);
  if (!result.ok) return <DetailUnavailable meta={meta} error={result.error} />;

  const { series, usdPerOz, audUsd } = result.data;
  const snap = snapshot(meta, series)!;
  const perGram = snap.current.value;
  const end = snap.current.date;
  const year = windowStats(pastYear(series))!;
  const insights = buildInsights(meta, series);

  // What drove the 12-month move (same maths as the real page): A$ gold =
  // US$ gold ÷ AUD/USD, so in log terms it splits into a gold and a currency part.
  const start = year.first.date;
  const usdNow = valueAt(usdPerOz, end)!;
  const usdThen = valueAt(usdPerOz, start)!;
  const fxNow = valueAt(audUsd, end)!;
  const fxThen = valueAt(audUsd, start)!;
  const total = (perGram / year.first.value - 1) * 100;
  const goldLog = Math.log(usdNow / usdThen);
  const fxLog = -Math.log(fxNow / fxThen);
  const totalLog = goldLog + fxLog;
  const goldPart = totalLog === 0 ? 0 : (total * goldLog) / totalLog;
  const fxPart = total - goldPart;
  const goldDelta = (year.first.value * goldPart) / 100;
  const fxDelta = perGram - year.first.value - goldDelta;

  // What A$1,000 of gold bought n years ago is worth now.
  const invested = [1, 3, 5, 10].flatMap((n) => {
    const then = valueAt(series, addYears(end, -n));
    return then ? [{ years: n, value: (1000 * perGram) / then, yearly: (((1000 * perGram) / then / 1000) ** (1 / n) - 1) * 100 }] : [];
  });

  /* -- 1 · the price, in four units ------------------------------------ */
  const prev = snap.previous;
  const label = changeLabel(meta, snap.current, prev);
  const usdPrev = prev ? valueAt(usdPerOz, prev.date) : undefined;
  const units: UnitView[] = [
    { key: "gram", button: "Per gram", title: "Price per gram", amount: perGram, money: "A$", digits: 2, caption: "1 g", currency: "AUD", change: snap.change, changeLabel: label },
    { key: "ounce", button: "Per ounce", title: "Price per ounce", amount: perGram * GRAMS_PER_TROY_OUNCE, money: "A$", digits: 0, caption: "31.1 g troy ounce", currency: "AUD", change: snap.change, changeLabel: label },
    { key: "kilo", button: "Per kilo", title: "Price per kilogram", amount: perGram * 1000, money: "A$", digits: 0, caption: "1,000 g bar", currency: "AUD", change: snap.change, changeLabel: label },
    {
      key: "usd",
      button: "US$ per oz",
      title: "World price per ounce",
      amount: usdNow,
      money: "US$",
      digits: 0,
      caption: "World price, 31.1 g troy ounce",
      currency: "USD",
      change: usdPrev ? (usdNow / usdPrev - 1) * 100 : undefined,
      changeLabel: label,
    },
  ];
  const record = insights.find((i) => i.icon === "record");
  const rank = insights.find((i) => i.icon === "rank");
  const streak = insights.find((i) => i.icon === "streak");
  // "Lowest in 13 months" reads on its own; a "Past 3 months" fallback needs its label.
  const recordPill = record && (/^(Recent|Record) /.test(record.label) ? record.value : `${record.label}: ${record.value}`);

  /* -- month-end and year-end prices ----------------------------------- */
  const closes = new Map<string, Point>();
  for (const p of series) closes.set(p.date.slice(0, 7), p);
  const months = Array.from({ length: 12 }, (_, i) => addMonths(`${end.slice(0, 7)}-01`, i - 11).slice(0, 7));
  const monthBars: Bar[] = months.map((ym) => {
    const p = closes.get(ym);
    return { key: ym, label: MON[Number(ym.slice(5)) - 1], short: MON[Number(ym.slice(5)) - 1][0], title: fmtMonth(`${ym}-01`), value: p?.value, text: p && money2(p.value), date: p && fmtDay(p.date) };
  });
  const endYear = Number(end.slice(0, 4));
  const yearBars: Bar[] = Array.from({ length: 5 }, (_, i) => {
    const y = String(endYear - 4 + i);
    const p = series.findLast((x) => x.date.startsWith(y));
    return { key: y, label: y, short: `’${y.slice(2)}`, title: y === String(endYear) ? `${y} so far` : y, value: p?.value, text: p && money2(p.value), date: p && fmtDay(p.date) };
  });
  // Older history has one price a month, dated the 1st, so those years end on 1 Dec.
  const firstOfDec = yearBars.filter((b) => b.key !== String(endYear) && series.findLast((x) => x.date.startsWith(b.key))?.date.endsWith("-12-01")).map((b) => b.key);
  const fiveYearCloses = [...closes.values()].filter((p) => p.date > addYears(end, -5)).map((p) => p.value);
  const fiveYearAvg = mean(fiveYearCloses);
  const modes: BarMode[] = [
    {
      key: "12m",
      button: "12 months",
      bars: monthBars,
      big: money2(year.mean),
      bigLabel: "Average of the prices on record, past 12 months, per gram",
      change: (perGram / year.mean - 1) * 100,
      changeLabel: "today vs average",
      caption: "Each bar is the last price on record that month, A$ per gram",
      gapNote: gapNote(monthBars, "daily"),
    },
    {
      key: "5y",
      button: "5 years",
      bars: yearBars,
      big: money2(fiveYearAvg),
      bigLabel: "Average of one price a month (the last on record), past 5 years, per gram",
      change: (perGram / fiveYearAvg - 1) * 100,
      changeLabel: "today vs average",
      caption: `Each bar is the last price on record that year (${endYear}: the latest), A$ per gram${
        firstOfDec.length ? `. The older history has one price a month, dated the 1st, so the ${firstOfDec.length === 1 ? firstOfDec[0] : `${firstOfDec[0]}–${firstOfDec[firstOfDec.length - 1]}`} ${firstOfDec.length === 1 ? "bar is a" : "bars are"} 1 Dec price${firstOfDec.length === 1 ? "" : "s"}` : ""
      }`,
      gapNote: gapNote(yearBars, "yearly"),
    },
  ];
  const barTicks = {
    "12m": ticks(Math.max(...monthBars.map((b) => b.value ?? 0))),
    "5y": ticks(Math.max(...yearBars.map((b) => b.value ?? 0))),
  };

  // Month-to-month moves for the little grid beside the hero number.
  const moves = months.map((ym) => {
    const cur = closes.get(ym);
    const before = closes.get(addMonths(`${ym}-01`, -1).slice(0, 7));
    return { key: ym, title: fmtMonth(`${ym}-01`), pct: cur && before ? (cur.value / before.value - 1) * 100 : undefined };
  });

  const gridShows = moves.filter((m) => m.pct !== undefined).length >= GRID_MIN;

  /* -- 2 · then and now ------------------------------------------------- */
  const ago = (n: number) => {
    const i = indexAt(series, addYears(end, -n));
    if (i < 0 || series[i].date === end) return undefined;
    return { point: series[i], pct: (perGram / series[i].value - 1) * 100 };
  };
  const then = [
    // The 12-month window's first price, so this card and "What moved the price" quote the same point.
    { n: 1, title: "1 year ago", icon: "calendar" as GlyphName, at: year.first.date === end ? undefined : { point: year.first, pct: total } },
    { n: 5, title: "5 years ago", icon: "history" as GlyphName, at: ago(5) },
  ];

  /* -- 6 · where it stands ---------------------------------------------- */
  const low = year.low;
  const high = year.high;
  const pos = Math.min(1, Math.max(0, (perGram - low.value) / (high.value - low.value || 1)));
  const verdict = pos < 0.08 ? "at the bottom of" : pos < 0.34 ? "in the lower part of" : pos > 0.92 ? "at the top of" : pos > 0.66 ? "in the upper part of" : "around the middle of";
  const belowHigh = ((high.value - perGram) / high.value) * 100;
  const aboveLow = ((perGram - low.value) / low.value) * 100;

  const decade = series.filter((p) => p.date >= addYears(end, -10));
  const avg10 = mean(decade.map((p) => p.value));
  const dAvg = (perGram / avg10 - 1) * 100;
  const avgMax = Math.max(perGram, avg10);

  // Typical move: the same measure as the insight (median size of every change
  // in the past 2 years). The biggest single day leaves out changes across a
  // break of more than 10 days, since those aren't one day's move.
  const twoYears = addYears(end, -2);
  const changes: { pct: number; date: string; days: number }[] = [];
  for (let i = 1; i < series.length; i++) {
    const a = series[i - 1];
    const b = series[i];
    if (b.date >= twoYears) changes.push({ pct: (b.value / a.value - 1) * 100, date: b.date, days: daysBetween(a.date, b.date) });
  }
  const sizes = changes.map((d) => Math.abs(d.pct)).sort((a, b) => a - b);
  const typical = sizes[Math.floor(sizes.length / 2)];
  const typicalText = typical === undefined ? "" : `±${formatUnsigned(typical, "%", typical < 0.1 ? 2 : 1)}`;
  const biggest = changes.filter((d) => d.days <= 10).reduce<(typeof changes)[number] | undefined>((m, d) => (!m || Math.abs(d.pct) > Math.abs(m.pct) ? d : m), undefined);
  const lastMove = changes[changes.length - 1];

  const rows: StandRow[] = [
    {
      icon: "range",
      label: "12-month range",
      pct: `${Math.round(pos * 100)}%`,
      fill: pos,
      value: (
        <>
          {money2(low.value)} <span className="text-white">– {money2(high.value)}</span>
        </>
      ),
      more: `Today's price is ${verdict} the past year's range: ${pos === 0 ? "0%" : `${Math.round(pos * 100)}%`} of the way from the low (${money2(low.value)} on ${fmtDay(low.date)}) to the high (${money2(high.value)} on ${fmtDay(high.date)}). That is ${belowHigh.toFixed(0)}% below the year's high and ${aboveLow.toFixed(0)}% above its low; the year's average was ${money2(year.mean)}.${record ? ` ${record.label}: ${record.value}, ${record.detail}.` : ""}`,
    },
    {
      icon: "average",
      label: "10-year average",
      pct: formatSigned(dAvg, "%"),
      fill: perGram / avgMax,
      tick: avg10 / avgMax,
      value: (
        <>
          {money2(perGram)} <span className="text-white">/ {money2(avg10)}</span>
        </>
      ),
      more: `Today's price is ${formatUnsigned(dAvg, "%")} ${dAvg >= 0 ? "above" : "below"} the average of the past 10 years (${money2(avg10)}). The bar is today's price; the white tick is the average.`,
    },
    // The insight's momentum fact: the past month, or (while the data has a gap) the 12-month peak.
    streak && streak.label !== "12-month peak"
      ? { icon: "growth", label: streak.label, pct: streak.value, value: streak.detail, more: `${streak.value} over the past month: it ${streak.detail}.` }
      : {
          icon: "peak",
          label: "Share of 12-month peak",
          pct: `${Math.round((perGram / high.value) * 100)}%`,
          fill: perGram / high.value,
          value: (
            <>
              {money2(perGram)} <span className="text-white">/ {money2(high.value)}</span>
            </>
          ),
          more:
            belowHigh < 0.5
              ? `Today's price is at its 12-month peak (${money2(high.value)}).`
              : `Today's price is ${belowHigh.toFixed(0)}% below its 12-month peak of ${money2(high.value)} on ${fmtDay(high.date)}. The bar is today's price as a share of that peak.`,
        },
    // The insight's move fact: the latest move, or (across a gap) the typical move.
    ...(typical !== undefined && biggest
      ? [
          rank?.label === "Latest move" && lastMove
            ? {
                icon: "pulse" as GlyphName,
                label: "Latest move",
                pct: formatSigned(lastMove.pct, "%"),
                fill: Math.abs(lastMove.pct) / Math.abs(biggest.pct),
                tick: typical / Math.abs(biggest.pct),
                value: (
                  <>
                    {typicalText} <span className="text-white">typical</span>
                  </>
                ),
                more: `${rank.value}: ${rank.detail}. The bar is the latest move against the biggest single-day move of the past 2 years (${formatSigned(biggest.pct, "%")} on ${fmtDay(biggest.date)}); the white tick is a typical day.`,
              }
            : {
                icon: "pulse" as GlyphName,
                label: rank?.label ?? "Typical move",
                pct: typicalText,
                fill: typical / Math.abs(biggest.pct),
                value: (
                  <>
                    {typicalText} <span className="text-white">/ {formatUnsigned(biggest.pct, "%")} biggest</span>
                  </>
                ),
                more: `${rank ? `${rank.value}: ${rank.detail}.` : `The usual daily change over the past 2 years is ${typicalText}.`} The biggest single-day move in that time was ${formatSigned(biggest.pct, "%")} on ${fmtDay(biggest.date)}; the bar compares the two.`,
              },
        ]
      : []),
  ];

  const best = invested.reduce((x, y) => (y.value > x.value ? y : x), invested[0]);
  const moveTotal = Math.abs(goldDelta) + Math.abs(fxDelta) || 1;
  const pctOf = (d: number) => `${Math.round((Math.abs(d) / moveTotal) * 100)}%`;
  const share = (d: number) => `${pctOf(d)} of the move`;
  const three = invested.find((i) => i.years === 3);
  const shown = invested.filter((i) => i.years !== 3);
  const money0 = (v: number) => `A$${Math.round(v).toLocaleString("en-AU")}`;

  const signedTone = (d: number) => (d >= 0 ? "text-(--up-ink)" : "text-(--down-ink)");
  const segTone = (d: number) => (d >= 0 ? "bg-linear-to-r from-(--up)/70 to-(--up) shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]" : "bg-linear-to-r from-(--down)/70 to-(--down) shadow-[inset_0_1px_0_rgb(255_255_255/0.35)]");
  const dotTone = (d: number) => (d >= 0 ? "bg-(--up) ring-3 ring-(--up)/20" : "bg-(--down) ring-3 ring-(--down)/20");

  return (
    <div className={`min-h-screen bg-(--pg) ${THEME}`}>
      <div className="mx-auto max-w-[1440px] px-2 py-2 sm:px-5 sm:py-5 lg:px-6 lg:py-6">
        <div className="rounded-[26px] bg-(--cv) px-3 pt-4 pb-6 shadow-[0_1px_3px_rgb(15_23_42/0.05)] sm:rounded-[32px] sm:p-6 lg:p-8">
          {/* top row: back to the overview · live + theme */}
          <div className="flex items-center justify-between gap-4 px-1">
            <Link href="/" className="group inline-flex items-center gap-3 rounded-full pr-2 focus-visible:rounded-full!">
              <span className="grid size-11 place-items-center rounded-full bg-linear-to-br from-(--feat-a) via-(--feat-m) to-(--feat-b) text-ink shadow-[0_6px_16px_-6px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.2)] transition-shadow duration-300 group-hover:shadow-[0_8px_22px_-6px_var(--hl-glow),inset_0_1px_0_rgb(255_255_255/0.2)]">
                <svg viewBox="0 0 16 16" className="size-[18px] transition-transform duration-300 group-hover:-translate-x-0.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M13 8H3M7 4L3 8l4 4" />
                </svg>
              </span>
              <span className="text-[17px] font-semibold tracking-tight">All indicators</span>
            </Link>
            <div className="flex items-center gap-2">
              <span className="hidden items-center gap-2 rounded-full bg-card px-4 py-2.5 text-[13px] text-muted shadow-(--cs) sm:inline-flex">
                <span className="animate-pulse-dot size-2 rounded-full bg-(--up)" aria-hidden="true" />
                Live · gold-api.com
              </span>
              <ThemeToggle />
            </div>
          </div>

          {/* hero: title, explainer, latest date */}
          <header className="mt-8 flex flex-wrap items-end justify-between gap-x-8 gap-y-4 px-1 sm:mt-10">
            <div className="min-w-0">
              <h1 className="text-[36px] leading-[1.05] font-medium tracking-[-0.03em] sm:text-[50px]">{meta.name}</h1>
              <p className="mt-3 max-w-[80ch] text-[15px] leading-6 text-muted sm:text-[16px]">{meta.explainer}</p>
            </div>
            <span className="inline-flex shrink-0 items-center gap-2 rounded-full bg-card px-4 py-2.5 text-sm shadow-(--cs)">
              <span className="relative grid size-4 place-items-center" aria-hidden="true">
                <Glyph name="calendar" className="size-4 text-muted" />
                <span className="absolute -top-0.5 -right-0.5 size-1.5 rounded-full bg-(--hl) shadow-[0_0_6px_var(--hl-glow)]" />
              </span>
              <span className="text-muted">Latest daily price</span>
              <span className="font-medium tabular-nums">{fmtDay(end)}</span>
            </span>
          </header>

          {/* two even columns from 1360px, one stack (hero → then/now → chart → …) below */}
          <div className="mt-7 flex flex-col gap-4 sm:mt-8 lg:gap-5 min-[1360px]:grid min-[1360px]:grid-cols-2 min-[1360px]:items-start">
            <div className="contents min-[1360px]:flex min-[1360px]:flex-col min-[1360px]:gap-5 min-[1360px]:self-stretch">
              <div className="order-1 min-[1360px]:order-none">
                <PriceHero
                  units={units}
                  date={fmtDayLong(end)}
                  side={gridShows ? <MoveGrid moves={moves} /> : undefined}
                  notes={recordPill && <span className="inline-flex max-w-full items-center rounded-full bg-inset px-3 py-1 text-[13px] font-medium text-ink">{recordPill}</span>}
                />
              </div>
              <div className="order-3 flex flex-col min-[1360px]:order-none min-[1360px]:flex-1">
                <PriceBars modes={modes} ticks={barTicks} />
              </div>
            </div>

            <div className="contents min-[1360px]:flex min-[1360px]:flex-col min-[1360px]:gap-5">
              {/* 2 · then vs now */}
              <div className="order-2 grid gap-4 min-[440px]:grid-cols-2 min-[1360px]:order-none lg:gap-5">
                {then.map(
                  (t) =>
                    t.at && (
                      <Panel key={t.n} labelledBy={`ago-${t.n}`}>
                        <PanelHead id={`ago-${t.n}`} icon={t.icon} title={t.title} />
                        <p className="mt-6 text-[34px] leading-none font-semibold tracking-[-0.035em] tabular-nums">{money2(t.at.point.value)}</p>
                        <p className="mt-2 text-[13px] text-muted">a gram on {fmtDay(t.at.point.date)}</p>
                        <div className="mt-4">
                          <Chip value={t.at.pct} label="to today" />
                        </div>
                      </Panel>
                    ),
                )}
              </div>

              {/* 3 · what moved it · 4 · A$1,000 of gold */}
              <div className="order-4 grid gap-4 sm:grid-cols-2 min-[1360px]:order-none lg:gap-5">
                <Panel labelledBy="moved-title" className="flex flex-col">
                  <PanelHead id="moved-title" icon="split" title="What moved the price" />
                  <p className="mt-6 text-[32px] leading-none font-semibold tracking-[-0.035em] tabular-nums">
                    {signedMoney(perGram - year.first.value)}
                    <span className="ml-1.5 text-sm font-normal tracking-normal text-muted">a gram</span>
                  </p>
                  <div className="mt-3">
                    <Chip value={total} label="in 12 months" />
                  </div>
                  <p className="mt-3 text-[13px] leading-5 text-muted">
                    <span className="tabular-nums">{money2(year.first.value)}</span> on <span className="whitespace-nowrap">{fmtDay(start)}</span> → <span className="font-medium text-ink tabular-nums">{money2(perGram)}</span> on <span className="whitespace-nowrap">{fmtDay(end)}</span>
                  </p>
                  <div className="mt-auto pt-6">
                    <div className="flex h-3.5 gap-1.5" role="img" aria-label={`Of the ${signedMoney(perGram - year.first.value)} change: world gold price ${signedMoney(goldDelta)} (${share(goldDelta)}), Australian dollar ${signedMoney(fxDelta)} (${share(fxDelta)})`}>
                      <span className={`min-w-2 origin-left animate-grow-x rounded-full motion-reduce:animate-none ${segTone(goldDelta)}`} style={{ width: `${(Math.abs(goldDelta) / moveTotal) * 100}%` }} />
                      <span className={`min-w-2 flex-1 origin-left animate-grow-x rounded-full [animation-delay:120ms] motion-reduce:animate-none ${segTone(fxDelta)}`} />
                    </div>
                    <ul className="mt-3.5 space-y-1.5 text-[13px] text-muted">
                      <li className="flex items-center gap-2">
                        <span className={`size-2.5 rounded-full ${dotTone(goldDelta)}`} aria-hidden="true" />
                        World gold price
                        <span className="ml-auto font-medium whitespace-nowrap tabular-nums">
                          <span className={signedTone(goldDelta)}>{signedMoney(goldDelta)}</span> <span className="text-faint">·</span> <span className="text-ink">{pctOf(goldDelta)}</span>
                        </span>
                      </li>
                      <li className="flex items-center gap-2">
                        <span className={`size-2.5 rounded-full ${dotTone(fxDelta)}`} aria-hidden="true" />
                        Australian dollar
                        <span className="ml-auto font-medium whitespace-nowrap tabular-nums">
                          <span className={signedTone(fxDelta)}>{signedMoney(fxDelta)}</span> <span className="text-faint">·</span> <span className="text-ink">{pctOf(fxDelta)}</span>
                        </span>
                      </li>
                    </ul>
                    <p className="mt-4 border-t border-line/70 pt-3.5 text-[14px] leading-6 text-muted">
                      Gold moved {formatSigned(goldPart, "%")} in US dollars; {fxPart < 0 ? "a stronger A$ cut the local price." : "a weaker A$ pushed the local price up."}
                    </p>
                  </div>
                </Panel>

                <section
                  aria-labelledby="bought-title"
                  className="relative isolate flex min-w-0 flex-col overflow-hidden rounded-[24px] bg-linear-155 from-(--feat-a) from-20% via-(--feat-m) via-55% to-(--feat-b) p-5 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.14),inset_0_0_0_1px_rgb(255_255_255/0.06),0_2px_6px_rgb(4_12_40/0.2),0_20px_44px_-18px_var(--glow)] transition-shadow duration-300 ease-out hover:shadow-[inset_0_1px_0_rgb(255_255_255/0.16),inset_0_0_0_1px_rgb(255_255_255/0.08),0_4px_10px_rgb(4_12_40/0.25),0_26px_54px_-18px_var(--hl-glow)] sm:p-6 in-data-[theme=dark]:ring-1 in-data-[theme=dark]:ring-white/10"
                >
                  {/* light: a neon glow behind the bars, a soft wash low down, one diagonal streak and a faint dot texture that fades out */}
                  <span className="pointer-events-none absolute -top-20 -right-16 -z-10 size-64 rounded-full bg-(--hl-glow)/30 blur-3xl" aria-hidden="true" />
                  <span className="pointer-events-none absolute -bottom-28 -left-16 -z-10 size-60 rounded-full bg-(--feat-b)/50 blur-3xl" aria-hidden="true" />
                  <span className="pointer-events-none absolute -top-1/2 left-[58%] -z-10 h-[200%] w-20 rotate-[28deg] bg-linear-to-r from-transparent via-white/[0.07] to-transparent" aria-hidden="true" />
                  <span className="pointer-events-none absolute inset-0 -z-10 bg-[radial-gradient(rgb(255_255_255/0.5)_1px,transparent_1px)] bg-size-[14px_14px] opacity-[0.14] mask-[linear-gradient(to_bottom,black,transparent_55%)]" aria-hidden="true" />
                  <h2 id="bought-title" className="max-w-[16ch] text-[19px] leading-snug font-medium tracking-[-0.015em]">
                    If you had bought A$1,000 of gold…
                  </h2>
                  <div className="flex flex-1 items-center justify-end py-2">
                    <GoldBars />
                  </div>
                  <p className="pt-4 text-[14px] leading-5 font-medium text-ink">Worth today if bought this long ago, before dealer fees</p>
                  <dl className="mt-3.5 grid grid-cols-3 divide-x divide-ink/15">
                    {shown.map((s) => (
                      <div key={s.years} className="min-w-0 px-2.5 first:pl-0 last:pr-0">
                        <dt className="text-[13px] text-ink">{s.years === 1 ? "1 year" : `${s.years} years`}</dt>
                        <dd className="mt-1 text-[18px] leading-tight font-semibold tracking-[-0.02em] tabular-nums">{money0(s.value)}</dd>
                        <dd className="mt-0.5 text-[12px] text-ink tabular-nums">{formatSigned(s.yearly, "%")}/yr</dd>
                      </div>
                    ))}
                  </dl>
                  {(three || best) && (
                    <p className="mt-4 border-t border-ink/10 pt-3 text-[13px] leading-5 text-ink">
                      {three && (
                        <span className="block">
                          3 years ago: <span className="font-semibold tabular-nums">{money0(three.value)}</span> ({formatSigned(three.yearly, "%")}/yr)
                        </span>
                      )}
                      {best && (
                        <span className="block">
                          Best: {best.years === 1 ? "1 year" : `${best.years} years`} ago, now <span className="font-semibold">{(best.value / 1000).toFixed(1)}×</span> what you paid
                        </span>
                      )}
                    </p>
                  )}
                </section>
              </div>

              {/* 6 · where it stands (dark list card) */}
              <section
                aria-labelledby="stands-title"
                className="@container relative isolate order-5 min-w-0 overflow-hidden rounded-[24px] bg-linear-160 from-(--dk) from-30% to-(--dk2) p-5 text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.08),inset_0_0_0_1px_rgb(255_255_255/0.05),0_2px_6px_rgb(0_0_0/0.15),0_20px_44px_-18px_rgb(0_0_0/0.5)] sm:p-6 min-[1360px]:order-none in-data-[theme=dark]:ring-1 in-data-[theme=dark]:ring-white/8"
              >
                <span className="pointer-events-none absolute -top-28 -right-20 -z-10 size-72 rounded-full bg-(--dk-bar)/12 blur-3xl" aria-hidden="true" />
                <PanelHead id="stands-title" icon="target" title="Where it stands" invert aside={<span className="text-[13px] text-(--dk-mute) max-[380px]:hidden">Open a row for more</span>} />
                <ul className="mt-5 space-y-2.5">
                  {rows.map((r, i) => (
                    <li key={r.label}>
                      <StandRowItem row={r} index={i} />
                    </li>
                  ))}
                </ul>
              </section>
            </div>
          </div>

          {/* 7 · the full history. */}
          <div className="mt-4 lg:mt-5">
            <Panel labelledBy="history-title" lift={false}>
              <PanelHead id="history-title" icon="line" title="Price history" aside={<Pill>A$ per gram</Pill>} />
              <div className="mt-6">
                <HistoryChart
                  ranges={buildRanges(meta, series, { end: today })}
                  format={meta.format}
                  frequency={meta.frequency}
                  polarity={meta.polarity}
                  changeUnit={meta.changeUnit}
                  defaultRange="all"
                />
              </div>
            </Panel>
          </div>

          <Sources ids={meta.sources} note="Official figures, refreshed every few hours" />
        </div>
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------------- */

/**
 * The feature card's illustration: three bars stacked two-and-one, drawn as
 * translucent glass with white bevels and a neon-blue rim light along each
 * top edge, sitting on a soft blue floor glow. Decoration only.
 */
function GoldBars() {
  const bars: [number, number][] = [
    [10, 62],
    [82, 62],
    [46, 38],
  ];
  return (
    <svg viewBox="2 30 152 66" className="h-auto w-[200px] sm:w-[210px] drop-shadow-[0_10px_16px_rgb(30_41_59/0.18)]" aria-hidden="true">
      <defs>
        <linearGradient id="gb-front" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".9" />
          <stop offset="1" stopColor="#7aa7ff" stopOpacity=".35" />
        </linearGradient>
        <linearGradient id="gb-top" x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#ffffff" stopOpacity=".85" />
          <stop offset="1" stopColor="#7aa7ff" stopOpacity=".4" />
        </linearGradient>
        <linearGradient id="gb-rim" x1="0" y1="0" x2="1" y2="0">
          <stop offset="0" stopColor="#7aa7ff" stopOpacity=".1" />
          <stop offset=".5" stopColor="#7aa7ff" />
          <stop offset="1" stopColor="#7aa7ff" stopOpacity=".1" />
        </linearGradient>
        <filter id="gb-glow" x="-30%" y="-200%" width="160%" height="500%">
          <feGaussianBlur stdDeviation="2.4" />
        </filter>
      </defs>
      <ellipse cx="78" cy="91" rx="70" ry="3" fill="#7aa7ff" opacity=".35" filter="url(#gb-glow)" />
      {bars.map(([x, y]) => (
        <g key={`${x}-${y}`}>
          <path d={`M${x} ${y + 28}h64l-7-20H${x + 7}z`} fill="url(#gb-front)" stroke="#7aa7ff" strokeOpacity=".7" strokeWidth="1.1" strokeLinejoin="round" />
          <path d={`M${x + 7} ${y + 8}h50l-5-8H${x + 12}z`} fill="url(#gb-top)" stroke="#ffffff" strokeOpacity=".8" strokeWidth="1.1" strokeLinejoin="round" />
          <path d={`M${x + 8.5} ${y + 10.5}h47`} stroke="#ffffff" strokeOpacity=".5" strokeWidth="1" strokeLinecap="round" />
          <rect x={x + 22} y={y + 15.5} width="20" height="7" rx="2" fill="none" stroke="#ffffff" strokeOpacity=".4" strokeWidth="1" />
          <path d={`M${x + 12} ${y}h40`} stroke="url(#gb-rim)" strokeWidth="3" strokeLinecap="round" filter="url(#gb-glow)" />
          <path d={`M${x + 12} ${y}h40`} stroke="#ffffff" strokeWidth=".9" strokeLinecap="round" />
        </g>
      ))}
      <circle cx="132" cy="40" r="1.6" fill="#7aa7ff" />
      <circle cx="132" cy="40" r="4" fill="#7aa7ff" opacity=".5" filter="url(#gb-glow)" />
      <circle cx="24" cy="50" r="1.1" fill="#7aa7ff" opacity=".8" />
    </svg>
  );
}

/** Fewest months with a move before the grid draws. */
const GRID_MIN = 8;

/**
 * The reference's little pixel grid, made real (columns fade in one by one): one column per month for the
 * past 12 months around a centre line. Rises stack green squares above the
 * line, falls hang red squares below it, so direction shows by position as
 * well as colour. Months without prices on both ends are plain grey. Hidden
 * unless most months have a move, so a gap in the data can't mislead.
 */
function MoveGrid({ moves }: { moves: { key: string; title: string; pct?: number }[] }) {
  const known = moves.filter((m) => m.pct !== undefined) as { key: string; title: string; pct: number }[];
  if (known.length < GRID_MIN) return null;
  const max = Math.max(...known.map((m) => Math.abs(m.pct)), 0.01);
  const ups = known.filter((m) => m.pct > 0).length;
  const missing = moves.length - known.length;
  const describe = `Month-to-month moves, past 12 months: up in ${ups} and down in ${known.length - ups} of the ${known.length} months with prices${missing ? `; ${missing} months have no prices on record` : ""}. ${known.map((m) => `${m.title} ${formatSigned(m.pct, "%")}`).join(", ")}.`;
  const square = (on: boolean, up: boolean) => `size-2.5 rounded-[3px] ${on ? (up ? "bg-(--up) shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]" : "bg-(--down) shadow-[inset_0_1px_0_rgb(255_255_255/0.3)]") : "bg-inset"}`;
  return (
    <>
      <p className="sr-only sm:hidden">{describe}</p>
      <figure className="mb-1 hidden shrink-0 flex-col items-end sm:flex">
        <div className="flex gap-[3px]" aria-hidden="true">
          {moves.map((m, col) => {
            const n = m.pct === undefined ? 0 : Math.max(1, Math.round((Math.abs(m.pct) / max) * 3));
            const up = (m.pct ?? 0) > 0;
            return (
              <div key={m.key} className="flex animate-rise flex-col gap-[3px] motion-reduce:animate-none" style={{ animationDelay: `${200 + col * 50}ms` }}>
                {[2, 1, 0].map((i) => (
                  <span key={`u${i}`} className={square(up && i < n, true)} />
                ))}
                <span className="h-px bg-line" />
                {[0, 1, 2].map((i) => (
                  <span key={`d${i}`} className={square(!up && m.pct !== undefined && i < n, false)} />
                ))}
              </div>
            );
          })}
        </div>
        <figcaption className="mt-2 text-[12px] text-muted">
          Month-to-month moves
          <span className="sr-only">. {describe}</span>
        </figcaption>
      </figure>
    </>
  );
}
