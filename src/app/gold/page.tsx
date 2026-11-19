import type { ReactNode } from "react";
import type { Metadata } from "next";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { DetailPage, DetailUnavailable, Headline } from "@/components/detail";
import { Card, CardTitle } from "@/components/ui";
import { InvestmentGrowth, PriceBridge, VizNote } from "@/components/viz";
import { GRAMS_PER_TROY_OUNCE } from "@/lib/data/gold";
import { getGold, getToday, META, snapshot } from "@/lib/data/indicators";
import { fmtDay, fmtMoney, formatSigned } from "@/lib/format";
import { addYears, indexAt, valueAt } from "@/lib/series";
import { buildRanges, pastYear } from "@/lib/view";

export const metadata: Metadata = { title: "Gold price · Simple Metrics Dashboard" };

export default async function GoldPage() {
  const meta = META.gold;
  const [result, today] = await Promise.all([getGold(), getToday()]);
  if (!result.ok) return <DetailUnavailable meta={meta} error={result.error} />;

  const { series, usdPerOz, audUsd } = result.data;
  const snap = snapshot(meta, series)!;
  const perGram = snap.current.value;
  // A year ago: the same reading the "1 year" fact uses, so the two cards agree.
  const yearAgo = indexAt(series, addYears(snap.current.date, -1));
  const first = yearAgo >= 0 ? series[yearAgo] : pastYear(series)[0];

  // What drove the 12-month move: A$ gold = US$ gold ÷ AUD/USD, so in log
  // terms the change splits exactly into a gold part and a currency part.
  const end = snap.current.date;
  const start = first.date;
  const usdNow = valueAt(usdPerOz, end)!;
  const usdThen = valueAt(usdPerOz, start)!;
  const fxNow = valueAt(audUsd, end)!;
  const fxThen = valueAt(audUsd, start)!;
  const total = (perGram / first.value - 1) * 100;
  const goldLog = Math.log(usdNow / usdThen);
  const fxLog = -Math.log(fxNow / fxThen);
  const totalLog = goldLog + fxLog;
  const goldPart = totalLog === 0 ? 0 : (total * goldLog) / totalLog;
  const fxPart = total - goldPart;
  const goldDelta = (first.value * goldPart) / 100;
  const fxDelta = perGram - first.value - goldDelta;

  // What A$1,000 of gold bought n years ago is worth now.
  const invested = [1, 3, 5, 10].flatMap((n) => {
    const then = valueAt(series, addYears(end, -n));
    return then ? [{ label: n === 1 ? "Bought 1 year ago" : `Bought ${n} years ago`, years: n, value: (1000 * perGram) / then }] : [];
  });

  // Each fact once, as on the Australian dollar page: the chart keeps only its line, plus the
  // note that explains any hole in the stored prices (the dashed stretch).
  const ranges = buildRanges(meta, series, { end: today });
  const gapNotes = ranges["5y"].story?.notes ?? [];

  return (
    <DetailPage meta={meta}>
      <div className="grid gap-3 sm:gap-4">
        <Headline meta={meta} snap={snap} note="per gram, in Australian dollars" dateLine="World price, converted to A$" series={series} facts="combined" />
        <Card>
          <CardTitle>Same price, other units</CardTitle>
          <div className="grid gap-2.5 sm:grid-cols-3 sm:gap-3">
            <Unit art="ounce" label="Per ounce" value={fmtMoney(perGram * GRAMS_PER_TROY_OUNCE, "A$")} note="31.1 g troy ounce" />
            <Unit art="kilo" label="Per kilogram" value={fmtMoney(perGram * 1000, "A$")} note="1,000 g bar" />
            <Unit art="usd" label="Per ounce in US$" value={fmtMoney(usdNow, "US$")} note="World price" />
          </div>
        </Card>
      </div>

      <Card>
        <HistoryChart
          ranges={{ "5y": { points: ranges["5y"].points }, "10y": { points: ranges["10y"].points }, all: { points: ranges.all.points } }}
          format={meta.format}
          frequency={meta.frequency}
          polarity={meta.polarity}
          changeUnit={meta.changeUnit}
          defaultRange="all"
        />
        {gapNotes.length > 0 && <p className="mt-4 text-xs text-faint">{gapNotes.join(" ")}</p>}
      </Card>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <Card>
          <CardTitle aside="past 12 months">What moved the price</CardTitle>
          <VizNote>
            Gold is priced in US dollars, so the price in A$ depends on two things: the world gold price and the Australian dollar.
          </VizNote>
          <PriceBridge
            from={{ label: `12 months ago · ${fmtDay(start)}`, value: first.value }}
            to={{ label: `Now · ${fmtDay(end)}`, value: perGram }}
            causes={[
              {
                label: "Australian dollar",
                value: fxDelta,
                note: fxPart < 0 ? "The A$ got stronger, so each A$ buys more gold." : "The A$ got weaker, so gold costs more in A$.",
              },
              {
                label: "World gold price",
                value: goldDelta,
                note: `Gold itself moved ${formatSigned(goldPart, "%")} in US dollars.`,
              },
            ]}
            format={(v) => `A$${v.toFixed(2)}`}
          />
        </Card>
        <Card>
          <CardTitle>If you had bought A$1,000 of gold…</CardTitle>
          <VizNote>What that gold would be worth today, before any dealer fees.</VizNote>
          <InvestmentGrowth paid={1000} items={invested} format={(v) => `A$${Math.round(v).toLocaleString("en-AU")}`} />
        </Card>
      </div>
    </DetailPage>
  );
}

type UnitArt = "gram" | "ounce" | "kilo" | "usd";

/** 14px line icons, the same style as the summary tiles. */
const unitGlyph: Record<UnitArt, ReactNode> = {
  gram: <path d="M4 11.5 5.5 7h5l1.5 4.5z" />,
  ounce: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="3" />
    </>
  ),
  kilo: <path d="M2 13.5 3.2 10.5h4.6L9 13.5zM7 13.5l1.2-3h4.6l1.2 3zM4.5 10.5l1.2-3h4.6l1.2 3z" />,
  usd: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M9.6 6.2c-.3-.5-.9-.8-1.6-.8-.9 0-1.6.5-1.6 1.2 0 1.7 3.3.8 3.3 2.6 0 .7-.7 1.2-1.7 1.2-.7 0-1.4-.3-1.7-.8M8 4.6v6.8" />
    </>
  ),
};

/** Each unit's icon gets one solid tile colour, like the indicator tiles (tokens, so dark mode follows). */
const unitTone: Record<UnitArt, string> = {
  gram: "bg-tile-amber text-on-tile",
  ounce: "bg-tile-blue text-on-tile-solid",
  kilo: "bg-tile-violet text-on-tile-solid",
  usd: "bg-tile-teal text-on-tile",
};

function Unit({ art, label, value, note }: { art: UnitArt; label: string; value: string; note: string }) {
  return (
    <div className="flex flex-col rounded-[16px] bg-inset p-4 transition-colors duration-300 hover:bg-chip sm:p-5">
      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-muted">{label}</p>
        <span className={`grid size-7 shrink-0 place-items-center rounded-full ${unitTone[art]}`}>
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {unitGlyph[art]}
          </svg>
        </span>
      </div>
      <p className="mt-3 text-[22px] leading-none font-bold tracking-tight text-ink tabular-nums">{value}</p>
      <p className="mt-2 text-xs text-faint">{note}</p>
    </div>
  );
}
