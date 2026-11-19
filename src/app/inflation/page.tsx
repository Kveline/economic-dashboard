import type { Metadata } from "next";
import { CategoryBars } from "@/components/CategoryBars";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { DetailPage, DetailUnavailable, Headline, PastYearStats } from "@/components/detail";
import { Card, CardTitle } from "@/components/ui";
import { TargetScale, VizNote, YearsVsTarget, type YearRange } from "@/components/viz";
import { getCpi, getToday, META, snapshot } from "@/lib/data/indicators";
import { statusFor } from "@/lib/status";
import { fmtDayShort, fmtMonth, formatValue } from "@/lib/format";
import { addYears, between, indexAt, windowStats } from "@/lib/series";
import { buildRanges, pastYear } from "@/lib/view";

export const metadata: Metadata = { title: "Inflation · Simple Metrics Dashboard" };

export default async function InflationPage() {
  const meta = META.cpi;
  const [result, today] = await Promise.all([getCpi(), getToday()]);
  if (!result.ok) return <DetailUnavailable meta={meta} error={result.error} />;

  const { series, monthlyFrom, categories, categoriesDate, nextRelease } = result.data;
  const snap = snapshot(meta, series)!;
  const last = snap.current.date;
  const decade = between(series, addYears(last, -10), last);
  const tenYears = windowStats(decade)!;
  const onTarget = (v: number) => v >= 2 && v <= 3;
  const inTarget = decade.filter((p) => onTarget(p.value)).length / (decade.length || 1);

  // One row per calendar year, newest first, for the last ten years.
  const endYear = Number(today.slice(0, 4));
  const years: YearRange[] = [];
  for (let y = endYear; y > endYear - 10; y--) {
    const pts = series.filter((p) => p.date.startsWith(String(y)));
    if (!pts.length) continue;
    const vals = pts.map((p) => p.value);
    years.push({
      year: String(y),
      low: Math.min(...vals),
      high: Math.max(...vals),
      avg: vals.reduce((a, b) => a + b, 0) / vals.length,
      partial: y === endYear && !pts.some((p) => p.date.slice(5, 7) === "12"),
    });
  }

  // Each fact once, as on the cash rate page: the chart keeps only its line (plus the note about
  // quarterly figures), and the 12-month card counts from the same reading as the "1 year" fact.
  const ranges = buildRanges(meta, series, { end: today, monthlyFrom });
  const chartNotes = ranges.all.story?.notes ?? [];
  const anchor = indexAt(series, addYears(last, -1));
  const yearPoints = (anchor >= 0 ? [series[anchor], ...pastYear(series)] : pastYear(series)).filter((p) => p.date >= monthlyFrom);

  return (
    <DetailPage meta={meta}>
      <div className="grid gap-3 sm:gap-4">
        <Headline
          meta={meta}
          snap={snap}
          status={statusFor(meta.key, snap.current.value, series, last)}
          series={series}
          dateLine={nextRelease ? `Next release ${fmtDayShort(nextRelease)}` : "Monthly figures from the ABS"}
          facts="combined"
        />
        <Card>
          <CardTitle aside="vs the RBA's target">How hot are prices?</CardTitle>
          <VizNote>The green band is the 2–3% the Reserve Bank aims for. The shaded strip is where inflation has been over the past ten years.</VizNote>
          <TargetScale
            value={snap.current.value}
            band={[2, 3]}
            range={{ low: tenYears.low.value, high: tenYears.high.value, label: "past 10 years" }}
            format={(v) => `${Number(v.toFixed(1))}%`}
            inTarget={inTarget}
          />
        </Card>
      </div>

      <Card>
        <HistoryChart
          ranges={{ "5y": { points: ranges["5y"].points }, "10y": { points: ranges["10y"].points }, all: { points: ranges.all.points } }}
          format={meta.format}
          frequency={meta.frequency}
          polarity={meta.polarity}
          changeUnit={meta.changeUnit}
          band={{ from: 2, to: 3, label: "The Reserve Bank's 2–3% target band" }}
          quarterlyBefore={monthlyFrom}
          zeroLine
          defaultRange="all"
        />
        {chartNotes.length > 0 && <p className="mt-4 text-xs text-faint">{chartNotes.join(" ")}</p>}
      </Card>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <PastYearStats meta={meta} points={yearPoints} full range={false} />
        <Card>
          <CardTitle aside={categoriesDate ? fmtMonth(categoriesDate) : undefined}>Annual price change by category</CardTitle>
          <CategoryBars items={categories} reference={{ value: snap.current.value, label: `All items ${formatValue(snap.current.value, meta.format)}` }} />
        </Card>
      </div>

      <Card>
        <CardTitle aside="annual change, by year">Ten years of inflation</CardTitle>
        <VizNote>Each row is a year. The dot is its average, the grey bar runs from its lowest to its highest reading.</VizNote>
        <YearsVsTarget years={years} band={[2, 3]} format={(v) => (Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`)} />
      </Card>
    </DetailPage>
  );
}
