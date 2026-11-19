import type { Metadata } from "next";
import { HistoryChart } from "@/components/charts/HistoryChart";
import {
  DetailPage,
  DetailUnavailable,
  Headline,
  PastYearStats,
} from "@/components/detail";
import { DecadeAverages, LinedUp, PeopleRow, VizNote, Waffle } from "@/components/viz";
import { Card, CardTitle } from "@/components/ui";
import {
  getToday,
  getUnemployment,
  META,
  snapshot,
} from "@/lib/data/indicators";
import { fmtDayShort, fmtMonth, formatValue } from "@/lib/format";
import { addYears, between, windowStats } from "@/lib/series";
import { statusFor } from "@/lib/status";
import { buildRanges, pastYear } from "@/lib/view";

export const metadata: Metadata = {
  title: "Unemployment rate · Simple Metrics Dashboard",
};

export default async function UnemploymentPage() {
  const meta = META.unemployment;
  const [result, today] = await Promise.all([getUnemployment(), getToday()]);
  if (!result.ok) return <DetailUnavailable meta={meta} error={result.error} />;

  const { series, nextRelease } = result.data;
  const snap = snapshot(meta, series)!;
  const last = snap.current.date;
  const tenYears = windowStats(between(series, addYears(last, -10), last))!;
  const decades = Array.from(new Set(series.map((p) => p.date.slice(0, 3)))).map((d) => {
    const vals = series.filter((p) => p.date.startsWith(d)).map((p) => p.value);
    return { label: `${d}0s`, value: vals.reduce((a, b) => a + b, 0) / vals.length, partial: Number(`${d}9`) > Number(today.slice(0, 4)) };
  });

  return (
    <DetailPage meta={meta}>
      <div className="grid gap-3 sm:gap-4">
        <Headline
          meta={meta}
          snap={snap}
          status={statusFor(meta.key, snap.current.value, series, last)}
          series={series}
          dateLine={`${fmtMonth(last)}${nextRelease ? ` · next ${fmtDayShort(nextRelease)}` : ""}`}
        />
        <Card>
          <CardTitle>Out of every 100 people</CardTitle>
          <VizNote>
            Picture 100 people who either have a job or are looking for one —
            the labour force.
          </VizNote>
          <Waffle
            value={snap.current.value}
            caption={
              <>
                <p className="text-[15px] leading-6 text-muted">
                  <strong className="text-[28px] font-medium tracking-tight text-bad tabular-nums">
                    {snap.current.value.toFixed(1)}
                  </strong>{" "}
                  <span className="text-ink">in every 100</span>
                  <span className="mt-1 block">
                    are looking for work but don&apos;t have a job. The other{" "}
                    {(100 - snap.current.value).toFixed(1)} are employed.
                  </span>
                </p>
                <dl className="mt-5 grid grid-cols-2 gap-2.5">
                  {[
                    { k: "10-year low", p: tenYears.low },
                    { k: "10-year high", p: tenYears.high },
                  ].map(({ k, p }) => (
                    <div key={k} className="rounded-[16px] bg-inset px-4 py-3.5">
                      <dt className="text-xs text-faint">{k}</dt>
                      <dd className="mt-0.5 text-lg font-medium tracking-tight tabular-nums">
                        {p.value.toFixed(1)}{" "}
                        <span className="text-xs font-normal text-faint">
                          in 100
                        </span>
                      </dd>
                      <dd className="text-[11px] text-faint">
                        {fmtMonth(p.date)}
                      </dd>
                      <dd className="mt-2.5">
                        <PeopleRow value={p.value} />
                      </dd>
                    </div>
                  ))}
                </dl>
              </>
            }
          />
        </Card>
      </div>

      <Card>
        <HistoryChart
          ranges={buildRanges(meta, series, { end: today })}
          format={meta.format}
          frequency={meta.frequency}
          polarity={meta.polarity}
          changeUnit={meta.changeUnit}
          defaultRange="all"
        />
      </Card>

      <Card>
        <CardTitle aside={`${series.length} months since ${series[0].date.slice(0, 4)}`}>Where today sits in history</CardTitle>
        <VizNote>Imagine every month since {series[0].date.slice(0, 4)} lined up from the lowest unemployment rate to the highest.</VizNote>
        <LinedUp points={series} current={snap.current.value} format={(v) => formatValue(v, meta.format)} when={fmtMonth} />
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-xs text-faint">Average by decade</p>
          <DecadeAverages items={decades} format={(v) => formatValue(v, meta.format)} />
        </div>
      </Card>

      <div className="grid gap-3 sm:gap-4">
        <PastYearStats meta={meta} points={pastYear(series)} full />
      </div>
    </DetailPage>
  );
}
