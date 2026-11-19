import type { Metadata } from "next";
import { CategoryBars } from "@/components/CategoryBars";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { DetailPage, DetailUnavailable, InsightGrid, PastYearStats } from "@/components/detail";
import { BigValue, StatusLine } from "@/components/home";
import { Card, CardTitle } from "@/components/ui";
import { TargetScale, VizNote, YearsVsTarget, type YearRange } from "@/components/viz";
import { getCpi, getToday, META, snapshot } from "@/lib/data/indicators";
import { fmtDayShort, fmtMonth, formatSigned, formatValue, valueParts } from "@/lib/format";
import { buildInsights } from "@/lib/insights";
import { addYears, between, windowStats } from "@/lib/series";
import { statusFor } from "@/lib/status";
import { buildRanges, pastYear } from "@/lib/view";

/*
 * Preview: the inflation page simplified to read like the home page.
 * Answer first, one main chart, one "why", and everything else folded into
 * "More detail". Each number is said once. Same look as the real page;
 * only the structure changes. Delete src/app/preview/ to remove it.
 */

export const metadata: Metadata = { title: "Inflation (preview) · Simple Metrics Dashboard", robots: { index: false } };

export default async function InflationPreview() {
  const meta = META.cpi;
  const [result, today] = await Promise.all([getCpi(), getToday()]);
  if (!result.ok) return <DetailUnavailable meta={meta} error={result.error} />;

  const { series, monthlyFrom, categories, categoriesDate, nextRelease } = result.data;
  const snap = snapshot(meta, series)!;
  const now = snap.current.value;
  const last = snap.current.date;
  const fmt = (v: number) => formatValue(v, meta.format);
  const parts = valueParts(meta.format);
  const status = statusFor(meta.key, now, series, last);

  // Three facts, not six: then, typical, and which way it's heading.
  const insights = buildInsights(meta, series);
  const facts = (["calendar", "average", "streak"] as const).map((k) => insights.find((i) => i.icon === k)).filter((i) => i !== undefined);

  const decade = between(series, addYears(last, -10), last);
  const tenYears = windowStats(decade)!;
  const inTarget = decade.filter((p) => p.value >= 2 && p.value <= 3).length / (decade.length || 1);

  // The answer in one sentence.
  const gap = now > 3 ? now - 3 : now < 2 ? 2 - now : 0;
  const sentence =
    gap === 0
      ? `Prices are ${fmt(now)} higher than a year ago, inside the Reserve Bank's 2–3% target.`
      : `Prices are ${fmt(now)} higher than a year ago, ${gap.toFixed(1)} points ${now > 3 ? "above" : "below"} the Reserve Bank's 2–3% target.`;

  // The "why": fastest and slowest categories, in words.
  const sorted = [...categories].sort((a, b) => b.value - a.value);
  const fastest = sorted[0];
  const slowest = sorted[sorted.length - 1];

  // The chart on its own: drop the stats panel under it (it repeated the hero).
  const ranges = buildRanges(meta, series, { end: today, monthlyFrom });
  const chartOnly = Object.fromEntries(Object.entries(ranges).map(([k, r]) => [k, { points: r.points }])) as typeof ranges;

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

  return (
    <DetailPage meta={meta}>
      {/* 1 · the answer */}
      <Card className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.5fr)]">
        <div className="flex flex-col">
          <span className="w-fit rounded-full bg-inset px-3 py-1.5 text-xs text-muted">
            Latest · <span className="text-ink">{fmtMonth(last)}</span>
          </span>
          <BigValue value={now} digits={parts.digits} prefix={parts.prefix} suffix={parts.suffix} size="xl" />
          {status && (
            <p className="mt-3">
              <StatusLine tone={status.tone} icon={status.icon}>
                {status.text}
              </StatusLine>
            </p>
          )}
          <p className="mt-4 max-w-[38ch] text-[15px] leading-6 text-muted">{sentence}</p>
          <p className="mt-auto pt-6 text-xs text-faint">{nextRelease ? `Next update ${fmtDayShort(nextRelease)}` : fmtMonth(last)}</p>
        </div>
        {facts.length > 0 && <InsightGrid insights={facts} />}
      </Card>

      {/* 2 · the trend */}
      <Card>
        <CardTitle aside="annual change">The trend</CardTitle>
        <VizNote>The shaded band is the Reserve Bank&apos;s 2–3% target. Hover the line for any month.</VizNote>
        <HistoryChart
          ranges={chartOnly}
          format={meta.format}
          frequency={meta.frequency}
          polarity={meta.polarity}
          changeUnit={meta.changeUnit}
          band={{ from: 2, to: 3, label: "The Reserve Bank's 2–3% target band" }}
          quarterlyBefore={monthlyFrom}
          zeroLine
          defaultRange="10y"
        />
      </Card>

      {/* 3 · the why */}
      <Card>
        <CardTitle aside={categoriesDate ? fmtMonth(categoriesDate) : undefined}>What&apos;s pushing prices up</CardTitle>
        {fastest && slowest && (
          <p className="-mt-2 mb-6 max-w-[62ch] text-[15px] leading-6 text-muted">
            <span className="text-ink">{fastest.name}</span> is rising fastest, at {formatSigned(fastest.value, "%")} a year.{" "}
            <span className="text-ink">{slowest.name}</span> is rising slowest, at {formatSigned(slowest.value, "%")}.
          </p>
        )}
        <CategoryBars items={categories} reference={{ value: now, label: `All items ${fmt(now)}` }} />
      </Card>

      {/* 4 · everything else, folded away */}
      <details className="group rounded-[28px] bg-card shadow-card">
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-6 [&::-webkit-details-marker]:hidden">
          <span>
            <span className="block text-[20px] leading-tight font-medium tracking-tight">More detail</span>
            <span className="mt-1 block text-xs text-faint">Target check · Past 12 months · Ten years, year by year</span>
          </span>
          <span className="grid size-9 shrink-0 place-items-center rounded-full bg-inset text-muted transition-transform group-open:rotate-180" aria-hidden="true">
            <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
              <path d="M4 6l4 4 4-4" />
            </svg>
          </span>
        </summary>

        <div className="space-y-10 px-6 pb-8">
          <section className="border-t border-line pt-8">
            <h3 className="mb-5 text-[17px] font-medium tracking-tight">Against the target · past 10 years</h3>
            <TargetScale
              value={now}
              band={[2, 3]}
              range={{ low: tenYears.low.value, high: tenYears.high.value, label: "past 10 years" }}
              format={(v) => `${Number(v.toFixed(1))}%`}
              inTarget={inTarget}
            />
          </section>

          <div className="border-t border-line pt-8 [&>section]:bg-transparent [&>section]:p-0 [&>section]:shadow-none">
            <PastYearStats meta={meta} points={pastYear(series).filter((p) => p.date >= monthlyFrom)} full />
          </div>

          <section className="border-t border-line pt-8">
            <h3 className="mb-2 text-[17px] font-medium tracking-tight">Ten years, year by year</h3>
            <p className="mb-5 text-xs leading-5 text-faint">Each row is a year. The dot is its average, the bar runs from its lowest to its highest reading.</p>
            <YearsVsTarget years={years} band={[2, 3]} format={(v) => (Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`)} />
          </section>
        </div>
      </details>
    </DetailPage>
  );
}
