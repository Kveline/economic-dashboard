import type { Metadata } from "next";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { DetailPage, DetailUnavailable } from "@/components/detail";
import { FactsPanel } from "@/components/Facts";
import { BigValue, Ring, StatusLine } from "@/components/home";
import { Card, CardTitle } from "@/components/ui";
import { RateStairs, VizNote } from "@/components/viz";
import { Mortgage, type MortgageBaseline } from "@/components/viz-client";
import { RBA_DECISION_DATES, upcomingDecisions } from "@/lib/data/calendar";
import { getCashRate, getToday, META } from "@/lib/data/indicators";
import { fmtDay, fmtMonth, formatValue, inDays } from "@/lib/format";
import { addYears, daysBetween } from "@/lib/series";
import { cashRateStatus, type BadgeTone } from "@/lib/status";
import { buildRanges, rateStatus } from "@/lib/view";

export const metadata: Metadata = { title: "Cash rate · Simple Metrics Dashboard" };

const statusPill: Record<BadgeTone, string> = {
  good: "bg-good-tint",
  bad: "bg-bad-tint-strong",
  warn: "bg-warn-tint",
  neutral: "bg-card",
  accent: "bg-primary-tint",
};

export default async function CashRatePage() {
  const meta = META["cash-rate"];
  const [result, today] = await Promise.all([getCashRate(), getToday()]);
  if (!result.ok) return <DetailUnavailable meta={meta} error={result.error} />;

  const { series, decisions } = result.data;
  const current = decisions[decisions.length - 1];
  const status = rateStatus(decisions, today);
  const badge = cashRateStatus(decisions, today);
  const held = status.text.startsWith("Unchanged");
  const upcoming = upcomingDecisions(today);
  // The staircase: the last 12 Board decisions, oldest first.
  const stairs = decisions.slice(-12).map((d) => ({
    date: d.date,
    month: `${fmtMonth(d.date).slice(0, 3)} ’${d.date.slice(2, 4)}`,
    change: d.change,
    rate: d.rate,
  }));

  // The low point of the last six years, for the mortgage comparison.
  const recentDecisions = decisions.filter((d) => d.date >= addYears(today, -6));
  const lowRate = Math.min(...recentDecisions.map((d) => d.rate));
  const lowFrom = recentDecisions.find((d) => d.rate === lowRate);
  const previous = status.lastChange ? status.lastChange.rate - status.lastChange.change : undefined;
  // Mortgage baselines: a year ago (default), before the last move, the low.
  const yearAgoDate = addYears(today, -1);
  const yearAgo = [...decisions].reverse().find((d) => d.date <= yearAgoDate);
  const baselines: MortgageBaseline[] = [
    ...(yearAgo ? [{ key: "year", label: "A year ago", rate: yearAgo.rate, when: fmtDay(yearAgoDate) }] : []),
    ...(status.lastChange && previous !== undefined
      ? [{ key: "last", label: "Before the last move", rate: previous, when: `the day before ${fmtDay(status.lastChange.date)}` }]
      : []),
    ...(lowFrom ? [{ key: "low", label: `The ${lowFrom.date.slice(0, 4)} low`, rate: lowRate, when: fmtDay(lowFrom.date) }] : []),
  ];
  // This cycle: since the low.
  const sinceLow = lowFrom ? decisions.filter((d) => d.date > lowFrom.date && d.change !== 0) : [];
  const cycleUps = sinceLow.filter((d) => d.change > 0).length;
  const cycleDowns = sinceLow.length - cycleUps;

  // Ring: share of the gap between Board decisions still to run.
  const next = upcoming[0];
  const prev = next ? [...RBA_DECISION_DATES].reverse().find((d) => d < next) : undefined;
  const daysLeft = next ? daysBetween(today, next) : undefined;
  const progress = next && prev ? daysBetween(today, next) / daysBetween(prev, next) : 0;

  // Each fact once, as on the Australian dollar page: the chart keeps only its line.
  const ranges = buildRanges(meta, series, { end: today });

  return (
    <DetailPage meta={meta}>
      <Card className="grid gap-4 p-3 sm:p-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.9fr)] lg:gap-5">
        {/* Headline: the rate and what changed (the rate before the move is in the facts beside it) */}
        <div className="flex flex-col rounded-[18px] bg-inset p-5 sm:p-6">
          <span className="inline-flex w-fit items-center gap-2 rounded-full bg-card px-3 py-1.5 text-xs text-muted shadow-card">
            <span className="size-1.5 rounded-full bg-primary-mark" aria-hidden="true" />
            <span>
              Latest · <span className="text-ink">{status.lastChange ? `set ${fmtDay(status.lastChange.date)}` : fmtDay(today)}</span>
            </span>
          </span>
          <BigValue value={current.rate} digits={2} suffix="%" size="xl" accent />
          <p className="mt-4">
            <span className={`inline-flex rounded-full px-3 py-1.5 ${statusPill[(held ? "neutral" : (badge?.tone ?? "neutral"))]}`}>
              <StatusLine tone={(held ? "neutral" : (badge?.tone ?? "neutral"))} icon={held ? "hold" : (badge?.icon ?? "hold")}>
                {status.text}
              </StatusLine>
            </span>
          </p>
          <p className="mt-auto flex items-center gap-1.5 pt-6 text-xs text-faint">
            <svg viewBox="0 0 16 16" className="size-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M2.5 6.5 8 3l5.5 3.5M3.5 6.5v5M6.5 6.5v5M9.5 6.5v5M12.5 6.5v5M2.5 13h11" />
            </svg>
            Set by the Reserve Bank Board
          </p>
        </div>
        <FactsPanel meta={meta} series={series} />
      </Card>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardTitle aside={next ? "RBA Board" : undefined}>Next decision</CardTitle>
          {next && daysLeft !== undefined ? (
            <>
              {/* Countdown ring beside the date */}
              <div className="flex items-center gap-6">
                <Ring progress={progress} size={120}>
                  <span className="block text-[34px] leading-none font-medium tracking-tight tabular-nums">{daysLeft}</span>
                  <span className="mt-1.5 block text-[11px] text-faint">{daysLeft === 1 ? "day to go" : "days to go"}</span>
                </Ring>
                <div className="min-w-0">
                  <p className="text-[22px] leading-tight font-medium tracking-tight">{fmtDay(next)}</p>
                  <span className="mt-2 inline-flex rounded-full bg-primary-tint px-2.5 py-1 text-xs font-medium text-primary">
                    {inDays(daysLeft)}
                  </span>
                  <p className="mt-3 flex items-center gap-1.5 text-xs text-muted">
                    <svg viewBox="0 0 16 16" className="size-3.5 shrink-0 text-faint" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
                      <circle cx="8" cy="8" r="6.25" />
                      <path d="M8 4.75V8l2.25 1.5" />
                    </svg>
                    Announced 2:30pm Sydney time
                  </p>
                </div>
              </div>

              {/* Upcoming meetings as small calendar tiles; the next one highlighted */}
              <div className="mt-auto pt-7">
                <p className="mb-2.5 text-xs text-faint">Coming up</p>
                <ol className="grid grid-cols-3 gap-2">
                  {upcoming.map((m, i) => {
                    const [day, month] = fmtDay(m).split(" ");
                    const first = i === 0;
                    return (
                      <li
                        key={m}
                        className={`animate-fade rounded-[14px] px-3 py-2.5 ${first ? "bg-primary-solid text-on-primary-solid" : "bg-inset"}`}
                        style={{ animationDelay: `${i * 80}ms` }}
                      >
                        <p className={`text-[11px] ${first ? "text-on-primary-solid/90" : "text-faint"}`}>
                          {month} {m.slice(0, 4)}
                        </p>
                        <p className="mt-0.5 text-[22px] leading-none font-medium tracking-tight tabular-nums">{day}</p>
                        <p className={`mt-1.5 text-[11px] ${first ? "text-on-primary-solid/90" : "text-faint"}`}>
                          {first ? "Next" : inDays(daysBetween(today, m))}
                        </p>
                      </li>
                    );
                  })}
                </ol>
              </div>
            </>
          ) : (
            <p className="text-sm text-faint">The RBA hasn&apos;t published its next schedule yet.</p>
          )}
        </Card>

        <Card className="flex flex-col">
          <CardTitle aside={lowFrom ? `since ${fmtDay(lowFrom.date)}` : undefined}>This cycle</CardTitle>
          {lowFrom ? (
            <>
              {/* Low and now, joined by the total move */}
              <div className="grid grid-cols-[1fr_auto_1fr] items-center gap-2 rounded-[16px] bg-inset p-2">
                <div className="rounded-[12px] bg-card px-4 py-3 shadow-card">
                  <p className="text-[11px] text-faint">The low</p>
                  <p className="mt-0.5 text-2xl font-medium tracking-tight tabular-nums">{formatValue(lowRate, meta.format)}</p>
                </div>
                <span className="flex flex-col items-center gap-1 px-1">
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap tabular-nums ${current.rate > lowRate ? "bg-bad-tint-strong text-bad" : current.rate < lowRate ? "bg-good-tint text-good" : "bg-chip text-muted"}`}>
                    {current.rate >= lowRate ? "+" : "−"}
                    {Math.abs(current.rate - lowRate).toFixed(2)}pp
                  </span>
                  <svg viewBox="0 0 24 12" className={`h-3 w-6 ${current.rate > lowRate ? "text-bad" : current.rate < lowRate ? "text-good" : "text-faint"}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                    <path d="M2 6h19M16 1.5 21 6l-5 4.5" />
                  </svg>
                </span>
                <div className="rounded-[12px] bg-card px-4 py-3 shadow-card">
                  <p className="text-[11px] text-faint">Now</p>
                  <p className="mt-0.5 text-2xl font-medium tracking-tight tabular-nums">{formatValue(current.rate, meta.format)}</p>
                </div>
              </div>

              {/* Every move as a bar off a baseline: rises up, cuts down, height by size */}
              <div className="mt-auto pt-7">
                <div className="mb-2.5 flex items-center justify-between gap-3 text-xs">
                  <p className="text-faint">Every move since, in order</p>
                  <p className="flex shrink-0 items-center gap-3 text-muted">
                    <span className="flex items-center gap-1.5">
                      <span className="size-2 rounded-full bg-bad-mark" />
                      {cycleUps} {cycleUps === 1 ? "rise" : "rises"}
                    </span>
                    {cycleDowns > 0 && (
                      <span className="flex items-center gap-1.5">
                        <span className="size-2 rounded-full bg-good-mark" />
                        {cycleDowns} {cycleDowns === 1 ? "cut" : "cuts"}
                      </span>
                    )}
                  </p>
                </div>
                <div className="rounded-[14px] bg-inset px-3 py-2.5">
                  <div className="relative flex h-16 items-stretch gap-[3px]">
                    <span className="absolute inset-x-0 top-[62%] h-px bg-faint/60" aria-hidden="true" />
                    {sinceLow.map((d, i) => {
                      const size = Math.min(1, Math.abs(d.change) / 0.5);
                      const up = d.change > 0;
                      return (
                        <span
                          key={d.date}
                          title={`${fmtDay(d.date)}: ${up ? "+" : "−"}${Math.round(Math.abs(d.change) * 100)} bp → ${formatValue(d.rate, meta.format)}`}
                          className="relative flex-1"
                        >
                          <span
                            className={`animate-fade absolute inset-x-0 rounded-[3px] ${up ? "bg-bad-mark" : "bg-good-mark"}`}
                            style={{
                              animationDelay: `${i * 35}ms`,
                              ...(up
                                ? { bottom: "38%", height: `${18 + size * 44}%` }
                                : { top: "62%", height: `${10 + size * 26}%` }),
                            }}
                          />
                        </span>
                      );
                    })}
                  </div>
                  <div className="mt-1.5 flex justify-between text-[11px] text-faint tabular-nums">
                    <span>{sinceLow[0] ? fmtMonth(sinceLow[0].date).slice(0, 3) + " ’" + sinceLow[0].date.slice(2, 4) : ""}</span>
                    <span>{sinceLow.length ? fmtMonth(sinceLow[sinceLow.length - 1].date).slice(0, 3) + " ’" + sinceLow[sinceLow.length - 1].date.slice(2, 4) : ""}</span>
                  </div>
                </div>
              </div>
            </>
          ) : (
            <p className="text-sm text-faint">No recent low to compare with.</p>
          )}
        </Card>
      </div>

      <Card>
        <HistoryChart
          ranges={{ "5y": { points: ranges["5y"].points }, "10y": { points: ranges["10y"].points }, all: { points: ranges.all.points } }}
          format={meta.format}
          frequency={meta.frequency}
          polarity={meta.polarity}
          changeUnit={meta.changeUnit}
          shape="step"
          defaultRange="all"
        />
      </Card>

      <div className="grid gap-3 sm:gap-4 md:grid-cols-2">
        <Card className="flex flex-col">
          <CardTitle aside="last 12 meetings">Meeting by meeting</CardTitle>
          <VizNote>The rate set at each Reserve Bank Board meeting.</VizNote>
          <RateStairs steps={stairs} />
        </Card>
        <Card>
          <CardTitle aside="30-yr variable">Your mortgage</CardTitle>
          <Mortgage rate={current.rate} baselines={baselines} history={stairs.map((s) => s.rate)} />
        </Card>
      </div>
    </DetailPage>
  );
}
