import type { Metadata } from "next";
import type { ReactNode } from "react";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { DetailPage, DetailUnavailable, Headline } from "@/components/detail";
import { Card, CardTitle, toneClass } from "@/components/ui";
import { ChangeRows, DecadeAverages, PeriodBars, VizNote } from "@/components/viz";
import { getGdp, getToday, META, snapshot, toneFor } from "@/lib/data/indicators";
import { fmtDayShort, fmtMonth, fmtQuarter, formatSigned } from "@/lib/format";
import { valueAt } from "@/lib/series";
import { statusFor } from "@/lib/status";
import { buildRanges } from "@/lib/view";

export const metadata: Metadata = { title: "GDP growth · Simple Metrics Dashboard" };

/** Plain-English line under each "also in this release" measure. */
const RELEASE_NOTES: Record<string, string> = {
  "Gross domestic product": "Everything the economy produced",
  "GDP per person": "Output shared across the population",
  "Domestic final demand": "Spending by households, businesses and government",
  "Market sector GVA": "Output of private businesses",
  "Real income per person": "Income per person, after inflation",
};

export default async function GdpPage() {
  const meta = META.gdp;
  const [result, today] = await Promise.all([getGdp(), getToday()]);
  if (!result.ok) return <DetailUnavailable meta={meta} error={result.error} />;

  const { series, quarterly, level, livingStandards, alsoInRelease, nextRelease } = result.data;
  const snap = snapshot(meta, series)!;
  const last = snap.current.date;
  const q = valueAt(quarterly, last);
  const lvl = valueAt(level, last);
  const living = livingStandards[livingStandards.length - 1];
  const sign = (v: number) => formatSigned(v, "%");

  // Last eight years of quarterly growth.
  const quarterBars = quarterly.slice(-32).map((p) => ({ date: p.date, label: fmtQuarter(p.date), value: p.value }));
  const shrank = quarterBars.filter((b) => b.value < 0);
  const grewCount = quarterBars.length - shrank.length;

  // Average annual growth per decade (the current decade so far).
  const byDecade = new Map<number, number[]>();
  for (const p of series) {
    const decade = Math.floor(Number(p.date.slice(0, 4)) / 10) * 10;
    byDecade.set(decade, [...(byDecade.get(decade) ?? []), p.value]);
  }
  const decades = [...byDecade.entries()]
    .sort(([a], [b]) => a - b)
    .map(([d, vals]) => ({
      label: `${d}s`,
      partial: d + 10 > Number(last.slice(0, 4)),
      value: vals.reduce((s, v) => s + v, 0) / vals.length,
    }));

  // Context for the "at a glance" rows.
  const tenYrQ = quarterly.slice(-40).map((p) => p.value);
  const typicalQ = tenYrQ.reduce((a, b) => a + b, 0) / (tenYrQ.length || 1);
  const levelYearAgo = level.length > 4 ? level[level.length - 5].value : undefined;
  const levelChange = lvl !== undefined && levelYearAgo ? ((lvl - levelYearAgo) / levelYearAgo) * 100 : undefined;
  const livingValue = living ? Number(living.value.toFixed(1)) : 0;
  const livingVerdict = livingValue === 0 ? "unchanged on a year ago" : livingValue > 0 ? "improving on a year ago" : "slipping on a year ago";

  const recentLevel = level.slice(-8);
  const levelMin = Math.min(...recentLevel.map((p) => p.value));
  const levelMax = Math.max(...recentLevel.map((p) => p.value));
  const growthMax = Math.max(Math.abs(q ?? 0), Math.abs(typicalQ), 0.1);
  const livingPos = Math.max(0, Math.min(100, 50 + (livingValue / 3) * 50)); // scale −3%…+3%

  return (
    <DetailPage meta={meta}>
      <div className="grid gap-3 sm:gap-4">
        <Headline
          meta={meta}
          snap={snap}
          note="growth over the past year"
          changeText="vs last quarter's yearly figure"
          status={statusFor(meta.key, snap.current.value, series, last)}
          series={series}
          dateLine={`${fmtQuarter(last)}${nextRelease ? ` · next ${fmtDayShort(nextRelease)}` : ""}`}
        />
        <Card className="flex flex-col">
          <CardTitle aside={fmtQuarter(last)}>This quarter at a glance</CardTitle>
          <div className="grid flex-1 gap-2.5 sm:grid-cols-3">
            {/* growth vs a typical quarter */}
            {q !== undefined && (
              <Tile label="Growth in the last 3 months" sub="vs the quarter before" value={sign(q)} tone={toneClass(toneFor(meta.polarity, q))}>
                <div className="space-y-2 text-[11px] text-faint">
                  {[
                    { k: "Last 3 months", v: q, cls: "bg-primary-mark" },
                    { k: "Typical 3 months", v: typicalQ, cls: "bg-soft" },
                  ].map((b) => (
                    <div key={b.k}>
                      <div className="flex justify-between">
                        <span>{b.k}</span>
                        <span className="text-muted tabular-nums">{sign(b.v)}</span>
                      </div>
                      <div className="mt-1 h-1.5 rounded-full bg-chip">
                        <div
                          className={`animate-grow-x h-full origin-left rounded-full ${b.v < 0 ? "bg-bad-mark" : b.cls}`}
                          style={{ width: `${Math.max(3, (Math.abs(b.v) / growthMax) * 100)}%` }}
                        />
                      </div>
                    </div>
                  ))}
                </div>
                <p className="mt-3 text-xs text-muted">
                  {q >= typicalQ ? "At or above" : "A little below"} a typical quarter (past 10 years)
                </p>
              </Tile>
            )}

            {/* size of the economy, last eight quarters */}
            {lvl !== undefined && (
              <Tile label="Size of the economy" value={`A$${(lvl / 1000).toFixed(1)}b`} tone="text-ink">
                <div className="flex h-12 items-end gap-1" aria-hidden="true">
                  {recentLevel.map((p, i) => (
                    <div
                      key={p.date}
                      className={`animate-grow-y flex-1 origin-bottom rounded-t-[3px] ${i === recentLevel.length - 1 ? "bg-primary-mark" : "bg-soft"}`}
                      style={{ height: `${30 + ((p.value - levelMin) / (levelMax - levelMin || 1)) * 70}%`, animationDelay: `${i * 40}ms` }}
                      title={`${fmtQuarter(p.date)}: A$${(p.value / 1000).toFixed(1)}b`}
                    />
                  ))}
                </div>
                <p className="mt-1.5 text-[11px] text-faint">last 8 quarters, after inflation</p>
                {levelChange !== undefined && (
                  <p className="mt-3 text-xs text-muted">
                    <span className={levelChange >= 0 ? "text-good" : "text-bad"}>{levelChange >= 0 ? "▲" : "▼"}</span>{" "}
                    {Math.abs(levelChange).toFixed(1)}% on a year ago
                  </p>
                )}
              </Tile>
            )}

            {/* living standards on a falling / rising scale */}
            {living && (
              <Tile label="Living standards" value={sign(livingValue)} tone={toneClass(toneFor("up-good", livingValue))}>
                <div aria-hidden="true">
                  <div className="relative h-1.5 rounded-full bg-chip">
                    <span className="absolute inset-y-0 left-0 w-1/2 rounded-l-full bg-bad-mark" />
                    <span className="absolute inset-y-0 right-0 w-1/2 rounded-r-full bg-good-mark" />
                    <span className="absolute top-1/2 left-1/2 h-3 w-px -translate-y-1/2 bg-faint" />
                    <span
                      className={`absolute top-1/2 size-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card ${
                        livingValue > 0 ? "bg-good-mark" : livingValue < 0 ? "bg-bad-mark" : "bg-ink/70"
                      }`}
                      style={{ left: `${livingPos}%` }}
                    />
                  </div>
                  <div className="mt-2 flex justify-between text-[11px] text-faint">
                    <span>falling</span>
                    <span>rising</span>
                  </div>
                </div>
                <p className="mt-1.5 text-[11px] text-faint">real income per person, year to {fmtMonth(living.date)}</p>
                <p className="mt-3 text-xs text-muted">{livingVerdict.charAt(0).toUpperCase() + livingVerdict.slice(1)}</p>
              </Tile>
            )}
          </div>
        </Card>
      </div>

      <Card>
        <HistoryChart
          ranges={buildRanges(meta, series, { end: today })}
          format={meta.format}
          frequency={meta.frequency}
          polarity={meta.polarity}
          changeUnit={meta.changeUnit}
          zeroLine
          defaultRange="all"
        />
      </Card>

      <Card>
        <CardTitle aside="growth in each quarter">Quarter by quarter</CardTitle>
        <VizNote>Each bar is one quarter&apos;s growth on the quarter before, over the past eight years. Hover a bar for its value.</VizNote>
        <p className="mb-6 text-[15px] leading-6 text-muted">
          The economy grew in <strong className="font-semibold text-good">{grewCount}</strong> of the last {quarterBars.length} quarters
          {shrank.length > 0 && (
            <>
              {" "}
              and shrank in <strong className="font-semibold text-bad">{shrank.length}</strong>
            </>
          )}
          .
        </p>
        <PeriodBars
          items={quarterBars}
          format={sign}
          typical={{ value: typicalQ, label: `typical quarter ${sign(typicalQ)}` }}
          period={{ from: "2020-01-01", to: "2021-12-31", label: "COVID-19" }}
        />
        <div className="mt-4 flex flex-wrap items-center gap-x-5 gap-y-1 text-xs text-faint">
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-soft" /> grew
          </span>
          <span className="flex items-center gap-1.5">
            <span className="size-2.5 rounded-sm bg-bad-mark" /> shrank
          </span>
          <span className="flex items-center gap-1.5">
            <span className="w-4 border-t border-dashed border-ink/50" /> typical quarter (past 10 years)
          </span>
        </div>
        <div className="mt-6 border-t border-line pt-5">
          <p className="mb-3 text-xs text-muted">Average annual growth by decade</p>
          <DecadeAverages items={decades} format={(v) => `${v.toFixed(1)}%`} highlight="max" />
        </div>
      </Card>

      <Card>
        <CardTitle aside={`${fmtQuarter(last)} · change on the quarter before`}>Also in this release</CardTitle>
        <VizNote>Other measures published alongside GDP, and how each changed in the last three months.</VizNote>
        <ChangeRows items={alsoInRelease.map((i) => ({ ...i, note: RELEASE_NOTES[i.name] }))} format={(v) => `${v.toFixed(1)}%`} />
      </Card>
    </DetailPage>
  );
}

/** One "at a glance" tile: label, big value, then a small visual pinned to the bottom. */
function Tile({ label, sub, value, tone, children }: { label: string; sub?: string; value: string; tone: string; children: ReactNode }) {
  return (
    <div className="flex flex-col rounded-[16px] bg-inset p-4 sm:p-5">
      <p className="text-xs text-muted">{label}</p>
      {sub && <p className="text-[11px] text-faint">{sub}</p>}
      <p className={`mt-1 text-[24px] leading-tight font-medium tracking-tight tabular-nums ${tone}`}>{value}</p>
      <div className="mt-auto pt-4">{children}</div>
    </div>
  );
}
