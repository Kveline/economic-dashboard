import type { Metadata } from "next";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { DetailPage, DetailUnavailable, Headline, PastYearStats } from "@/components/detail";
import { Card, CardTitle } from "@/components/ui";
import { CurrencyMoves, VizNote, YearRanges } from "@/components/viz";
import { Converter } from "@/components/viz-client";
import { getAudUsd, getToday, META, snapshot } from "@/lib/data/indicators";
import { fmtDayLong } from "@/lib/format";
import { addYears, indexAt } from "@/lib/series";
import { buildRanges, pastYear } from "@/lib/view";

export const metadata: Metadata = { title: "Australian dollar · Simple Metrics Dashboard" };

export default async function AudUsdPage() {
  const meta = META.audusd;
  const [result, today] = await Promise.all([getAudUsd(), getToday()]);
  if (!result.ok) return <DetailUnavailable meta={meta} error={result.error} />;

  const { series, crosses } = result.data;
  const snap = snapshot(meta, series)!;

  // Year by year: low, high and average of the daily/monthly rate, newest first.
  const thisYear = Number(today.slice(0, 4));
  const years = Array.from({ length: 10 }, (_, i) => String(thisYear - i)).flatMap((year) => {
    const vals = series.filter((p) => p.date.startsWith(year)).map((p) => p.value);
    if (!vals.length) return [];
    return [{ year, low: Math.min(...vals), high: Math.max(...vals), avg: vals.reduce((a, b) => a + b, 0) / vals.length, partial: year === String(thisYear) }];
  });

  const moves = crosses
    .filter((c) => c.change12m !== undefined)
    .map((c) => ({ code: c.code, name: c.name, symbol: c.symbol, now: c.rate, then: c.rate / (1 + c.change12m! / 100), change: c.change12m! }))
    .sort((a, b) => b.change - a.change);

  // Each fact once: the chart keeps only its line (its summary tiles repeated the headline),
  // and the 12-month card counts from the same reading as the "1 year" fact above it.
  const ranges = buildRanges(meta, series, { end: today });
  const anchor = indexAt(series, addYears(snap.current.date, -1));
  const yearPoints = anchor >= 0 ? [series[anchor], ...pastYear(series)] : pastYear(series);

  return (
    <DetailPage meta={meta}>
      <Headline
        meta={meta}
        snap={snap}
        note="for one Australian dollar"
        dateLine="RBA 4pm rate"
        series={series}
        facts="combined"
      />
      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <PastYearStats meta={meta} points={yearPoints} range={false} />
        <Card>
          <CardTitle>Travel money</CardTitle>
          <VizNote>What your Australian dollars are worth in other currencies today.</VizNote>
          <Converter rates={crosses} date={crosses[0] ? fmtDayLong(crosses[0].date) : ""} />
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
      </Card>

      <Card>
        <CardTitle aside="past 12 months">Stronger or weaker?</CardTitle>
        <CurrencyMoves items={moves} />
      </Card>

      <Card>
        <CardTitle aside="US cents per A$1">The A$ year by year</CardTitle>
        <VizNote>How many US cents one Australian dollar bought each year: the bar runs from the year&apos;s low to its high, the dot is the average.</VizNote>
        <YearRanges years={years} format={(v) => `${(v * 100).toFixed(1)}¢`} formatChange={(p) => `${p.toFixed(1)}%`} />
      </Card>
    </DetailPage>
  );
}
