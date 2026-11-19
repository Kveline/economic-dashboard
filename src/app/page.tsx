import Link from "next/link";
import type { ReactNode } from "react";
import { BigValue, ChangeLine, HomeCard, Ring, StatusLine, Tile } from "@/components/home";
import { CapsuleBars, CurveChart, FloatList, FloatRow } from "@/components/home-viz";
import { PendingArea, PendingProvider } from "@/components/Pending";
import { HeroTitle, LivePill, Shell } from "@/components/Shell";
import { Sources } from "@/components/Sources";
import { ViewSwitcher, type ViewOption } from "@/components/ViewSwitcher";
import { buildBrief, headline } from "@/lib/brief";
import { RBA_DECISION_DATES } from "@/lib/data/calendar";
import {
  getAudUsd,
  getCashRate,
  getCpi,
  getGdp,
  getGold,
  getToday,
  getUnemployment,
  META,
  snapshot,
  type CashRateData,
  type IndicatorMeta,
  type Loaded,
} from "@/lib/data/indicators";
import { fmtDay, fmtDayShort, fmtMonth, fmtPeriod, formatValue, inDays } from "@/lib/format";
import { addYears, daysBetween, indexAt, toDate, type Point } from "@/lib/series";
import { cashRateStatus, statusFor } from "@/lib/status";
import { changeLabel, rateStatus } from "@/lib/view";

const VIEWS = [
  { key: "now", years: 0, label: "Today", short: "Today" },
  { key: "1y", years: 1, label: "1 year ago", short: "1 yr" },
  { key: "5y", years: 5, label: "5 years ago", short: "5 yrs" },
  { key: "10y", years: 10, label: "10 years ago", short: "10 yrs" },
] as const;

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

/** "Dec ’25" for chart ticks. */
const tickMonth = (iso: string) => `${fmtMonth(iso).slice(0, 3)} ’${iso.slice(2, 4)}`;

export default async function Home({ searchParams }: PageProps<"/">) {
  const { view: viewParam } = await searchParams;
  const view = VIEWS.find((v) => v.key === viewParam) ?? VIEWS[0];
  const now = await getToday();
  const asOf = addYears(now, -view.years);
  const isNow = view.years === 0;
  const pastAsOf = isNow ? undefined : asOf;

  const [audusd, gold, cash, cpi, unemployment, gdp] = await Promise.all([
    getAudUsd(),
    getGold(),
    getCashRate(),
    getCpi(),
    getUnemployment(),
    getGdp(),
  ]);

  const options: ViewOption[] = VIEWS.map((v) => ({
    key: v.key,
    label: v.label,
    short: v.short,
    detail: v.years ? fmtMonth(addYears(now, -v.years)) : "Latest figures",
  }));
  const lead = headline(buildBrief({ cash, cpi, unemployment, gdp, audusd }, pastAsOf, now));

  return (
    <PendingProvider>
      <Shell
        topLeft={
          <div className="flex flex-wrap items-center gap-x-6 gap-y-4">
            <DateBadge iso={asOf} />
            <span className="hidden h-10 w-px bg-line sm:block" aria-hidden="true" />
            <ViewSwitcher options={options} current={view.key} />
          </div>
        }
        topRight={
          isNow ? (
            <LivePill />
          ) : (
            <Link
              href="/"
              scroll={false}
              className="inline-flex items-center gap-2 rounded-full bg-card px-4 py-2.5 text-xs font-medium shadow-card transition hover:text-primary"
            >
              <span className="size-2 rounded-full bg-primary-mark" aria-hidden="true" />
              Back to today
            </Link>
          )
        }
        hero={
          <HeroTitle
            title={isNow ? "Australia's economy, today." : `Australia's economy, ${view.label}.`}
            lead={
              lead && (
                <>
                  <span
                    className="mr-1 inline-block h-[0.9em] w-[2px] translate-y-[0.12em] bg-primary-mark"
                    style={{ animation: "caret 1.1s steps(1) infinite" }}
                    aria-hidden="true"
                  />
                  <Link href={lead.href} className="transition-colors hover:text-muted">
                    {lead.text}
                  </Link>
                </>
              )
            }
          />
        }
      >
        <PendingArea>
          <div className="grid gap-4 sm:gap-5 md:grid-cols-2 lg:grid-cols-3">
            <MarketCard meta={META.audusd} result={audusd} asOf={pastAsOf} delay={60} hero className="md:col-span-2" />
            <CashRateCard result={cash} asOf={asOf} isNow={isNow} delay={120} />
            <MarketCard meta={META.gold} result={gold} asOf={pastAsOf} delay={180} />
            <StatsCard asOf={pastAsOf} delay={240} items={[{ meta: META.cpi, result: cpi }, { meta: META.unemployment, result: unemployment }, { meta: META.gdp, result: gdp }]} />
          </div>
        </PendingArea>

        <Sources
          ids={["rba", "abs", "goldapi", "freegold"]}
          note={isNow ? "Official figures, refreshed every few hours" : `Showing figures published by ${fmtDay(asOf)}`}
          icon={isNow ? "refresh" : "clock"}
        />
      </Shell>
    </PendingProvider>
  );
}

/** "( 7 )  Sat, November 2026" */
function DateBadge({ iso }: { iso: string }) {
  const d = toDate(iso);
  return (
    <div className="flex items-center gap-3">
      <span className="grid size-14 place-items-center rounded-full bg-card text-2xl font-medium tracking-tight text-primary shadow-card">
        {d.getUTCDate()}
      </span>
      <span className="text-sm leading-snug">
        {WEEKDAYS[d.getUTCDay()]},
        <br />
        {MONTHS[d.getUTCMonth()]} <span className="text-faint">{d.getUTCFullYear()}</span>
      </span>
    </div>
  );
}

function Card({ meta, delay, className, children }: { meta: IndicatorMeta; delay: number; className?: string; children: ReactNode }) {
  return (
    <HomeCard title={meta.name} group={meta.group} href={meta.href} icon={meta.key} explainer={meta.explainer} delay={delay} className={className}>
      {children}
    </HomeCard>
  );
}

function Empty({ meta, delay, message, className }: { meta: IndicatorMeta; delay: number; message: string; className?: string }) {
  return (
    <Card meta={meta} delay={delay} className={className}>
      <p className="mt-6 text-sm text-faint">{message}</p>
    </Card>
  );
}

/** The year up to `date`. */
function pastYearTo(series: Point[], date: string): Point[] {
  const end = indexAt(series, date);
  const from = addYears(date, -1);
  return series.slice(0, end + 1).filter((p) => p.date >= from);
}

function MarketCard({
  meta,
  result,
  asOf,
  delay,
  hero = false,
  className,
}: {
  meta: IndicatorMeta;
  result: Loaded<{ series: Point[] }>;
  asOf?: string;
  delay: number;
  hero?: boolean;
  className?: string;
}) {
  if (!result.ok) return <Empty meta={meta} delay={delay} className={className} message="Data is temporarily unavailable." />;
  const series = result.data.series;
  const snap = snapshot(meta, series, asOf);
  if (!snap) return <Empty meta={meta} delay={delay} className={className} message="No data for this date." />;
  const fx = meta.key === "audusd";
  const year = pastYearTo(series, snap.current.date);
  const fmt = (v: number) => formatValue(v, meta.format);

  return (
    <Card meta={meta} delay={delay} className={className}>
      <div className="mt-6 flex flex-wrap items-end justify-between gap-x-6 gap-y-2">
        <div>
          <BigValue value={snap.current.value} digits={fx ? 4 : 2} prefix={fx ? "US$" : "A$"} size={hero ? "xl" : "lg"} />
          <p className="mt-2 text-xs text-faint">{fx ? "what one Australian dollar buys" : "for one gram of gold"}</p>
        </div>
        <ChangeLine
          value={snap.change}
          unit="%"
          tone={snap.change === undefined || Number(snap.change.toFixed(2)) === 0 ? "neutral" : snap.change > 0 ? "good" : "bad"}
          label={changeLabel(meta, snap.current, snap.previous)} />
      </div>
      <div className="mt-auto pt-8">
        <CurveChart
          id={meta.key}
          points={year}
          format={fmt}
          callout={fmtDay(snap.current.date)}
          tickLabel={tickMonth}
          ticks={hero ? 5 : 3}
          height={hero ? 190 : 130}
          markers={hero}
        />
      </div>
    </Card>
  );
}

function CashRateCard({ result, asOf, isNow, delay }: { result: Loaded<CashRateData>; asOf: string; isNow: boolean; delay: number }) {
  const meta = META["cash-rate"];
  if (!result.ok) return <Empty meta={meta} delay={delay} message="Data is temporarily unavailable." />;
  const { series, decisions } = result.data;
  const snap = snapshot(meta, series, asOf);
  if (!snap) return <Empty meta={meta} delay={delay} message="No data for this date." />;
  const status = rateStatus(decisions, asOf);
  const badge = cashRateStatus(decisions, asOf);
  const held = status.text.startsWith("Unchanged");

  const steps = decisions
    .filter((d) => d.date <= asOf)
    .slice(-8)
    .map((d) => ({ date: d.date, label: fmtMonth(d.date).slice(0, 3), rate: d.rate, change: d.change }));

  // Ring: share of the gap between Board decisions still to run, so it empties as the day nears.
  const next = isNow ? RBA_DECISION_DATES.find((d) => d >= asOf) : undefined;
  const prev = next ? [...RBA_DECISION_DATES].reverse().find((d) => d < next) : undefined;
  const daysLeft = next ? daysBetween(asOf, next) : undefined;
  const progress = next && prev ? daysBetween(asOf, next) / daysBetween(prev, next) : 0;
  const monthsSame = status.lastChange ? Math.floor(daysBetween(status.lastChange.date, asOf) / 30.44) : 0;

  return (
    <Card meta={meta} delay={delay}>
      <BigValue value={snap.current.value} digits={2} suffix="%" size="xl" />
      <p className="mt-3">
        <StatusLine tone={held ? "neutral" : (badge?.tone ?? "neutral")} icon={held ? "hold" : (badge?.icon ?? "hold")}>
          {status.text}
        </StatusLine>
      </p>

      <div className="mt-6">
        <div className="mb-3 flex items-center justify-between text-[11px] text-faint">
          <span>Last {steps.length} decisions</span>
          <span className="flex items-center gap-3">
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-bad-mark" /> raised
            </span>
            <span className="flex items-center gap-1">
              <span className="size-2 rounded-full bg-good-mark" /> cut
            </span>
          </span>
        </div>
        <CapsuleBars steps={steps} />
      </div>

      <div className="mt-auto flex items-center gap-4 rounded-[16px] bg-inset p-3 pt-3">
        {daysLeft !== undefined ? (
          <Ring progress={progress} size={64}>
            <span className="block text-lg leading-none font-semibold tabular-nums">{daysLeft}</span>
            <span className="block text-[9px] text-faint">days</span>
          </Ring>
        ) : (
          <Ring progress={Math.min(1, monthsSame / 24)} size={64}>
            <span className="block text-lg leading-none font-semibold tabular-nums">{monthsSame}</span>
            <span className="block text-[9px] text-faint">months</span>
          </Ring>
        )}
        <div className="text-sm">
          {next ? (
            <>
              <p className="text-xs text-faint">Next decision</p>
              <p className="font-medium">{fmtDay(next)}</p>
              <p className="text-xs text-primary">{inDays(daysLeft!)}</p>
            </>
          ) : status.lastChange ? (
            <>
              <p className="text-xs text-faint">Last changed</p>
              <p className="font-medium">{fmtDay(status.lastChange.date)}</p>
            </>
          ) : null}
        </div>
      </div>
    </Card>
  );
}

type StatItem = { meta: IndicatorMeta; result: Loaded<{ series: Point[]; nextRelease?: string }> };

/** Inflation, unemployment and GDP as floating rows on a tinted panel. */
function StatsCard({ items, asOf, delay }: { items: StatItem[]; asOf?: string; delay: number }) {
  return (
    <article className="animate-rise flex min-w-0 flex-col rounded-[20px] bg-card p-6 shadow-card md:col-span-2" style={{ animationDelay: `${delay}ms` }}>
      <div className="mb-5 flex items-baseline justify-between gap-4">
        <div>
          <h3 className="text-[15px] font-medium">Prices, jobs &amp; growth</h3>
          <p className="mt-0.5 text-xs text-faint">Official statistics from the ABS</p>
        </div>
        <span className="text-xs text-faint">trend · past 2–3 years</span>
      </div>
      <FloatList>
        {items.map(({ meta, result }, i) => (
          <StatRow key={meta.key} meta={meta} result={result} asOf={asOf} delay={delay + 80 + i * 70} />
        ))}
      </FloatList>
    </article>
  );
}

function StatRow({ meta, result, asOf, delay }: StatItem & { asOf?: string; delay: number }) {
  const icon = <Tile indicator={meta.key} round />;
  if (!result.ok)
    return (
      <FloatRow href={meta.href} icon={icon} title={meta.name} subtitle="Data is temporarily unavailable" value="—" status={null} chart={null} delay={delay} />
    );
  const series = result.data.series;
  const snap = snapshot(meta, series, asOf);
  if (!snap) return <FloatRow href={meta.href} icon={icon} title={meta.name} subtitle="No data for this date" value="—" status={null} chart={null} delay={delay} />;
  const next = asOf === undefined ? result.data.nextRelease : undefined;
  // CPI before Apr 2025 is quarterly; label its period accordingly.
  const gap = snap.previous ? daysBetween(snap.previous.date, snap.current.date) : 0;
  const frequency = meta.frequency === "monthly" && gap > 45 ? "quarterly" : meta.frequency;
  const status = statusFor(meta.key, snap.current.value, series, snap.current.date);
  const end = indexAt(series, snap.current.date);
  const trend = series.slice(Math.max(0, end - (frequency === "quarterly" ? 11 : 23)), end + 1);

  return (
    <FloatRow
      href={meta.href}
      icon={icon}
      title={meta.name}
      subtitle={`${fmtPeriod(snap.current.date, frequency)}${next ? ` · next ${fmtDayShort(next)}` : ""}`}
      delay={delay}
      chart={<CurveChart id={`row-${meta.key}`} points={trend} format={(v) => formatValue(v, meta.format)} height={40} mini />}
      value={
        <span className="text-[26px] leading-none font-medium tracking-tight tabular-nums">
          {snap.current.value.toFixed(1)}
          <span className="ml-0.5 text-[0.62em] font-normal text-faint">%</span>
        </span>
      }
      status={
        status && (
          <span className="mt-1 inline-block whitespace-nowrap [&>span]:text-xs">
            <StatusLine tone={status.tone} icon={status.icon}>
              {status.text}
            </StatusLine>
          </span>
        )
      }
    />
  );
}
