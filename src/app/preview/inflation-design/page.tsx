import type { Metadata } from "next";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { CategoryBars } from "@/components/CategoryBars";
import { HistoryChart } from "@/components/charts/HistoryChart";
import { DetailUnavailable, InsightGrid, PastYearStats } from "@/components/detail";
import { Sources } from "@/components/Sources";
import { ThemeToggle } from "@/components/ThemeToggle";
import { TargetScale, YearsVsTarget, type YearRange } from "@/components/viz";
import { getCpi, getToday, META, snapshot } from "@/lib/data/indicators";
import { fmtMonth, formatSigned, formatValue } from "@/lib/format";
import { buildInsights } from "@/lib/insights";
import { addYears, between, windowStats } from "@/lib/series";
import { statusFor } from "@/lib/status";
import { buildRanges, pastYear } from "@/lib/view";

/*
 * Preview: the real inflation page's content and charts, in the design
 * system of the "Financial Dashboard" reference: a soft grey top band with
 * round outline buttons and a two-tone statement; grey rounded cards on
 * white, each holding a white card; outline pills, a black status pill,
 * white icon circles and one accent (pink) used sparingly. No shadows.
 * Only this route uses it; delete src/app/preview/inflation-design/ to remove.
 */

export const metadata: Metadata = { title: "Inflation (design preview) · Simple Metrics Dashboard", robots: { index: false } };

// Neutral greys mixed from the theme's own ink/canvas (so dark mode works),
// and flat surfaces: the reference has no shadows.
const DS = {
  "--color-inset": "color-mix(in srgb, var(--color-ink) 4%, var(--color-canvas))",
  "--color-chip": "color-mix(in srgb, var(--color-ink) 8%, var(--color-canvas))",
  "--color-line": "color-mix(in srgb, var(--color-ink) 9%, var(--color-canvas))",
  "--color-mist": "color-mix(in srgb, var(--color-ink) 4%, var(--color-canvas))",
  "--shadow-card": "none",
  "--shadow-pop": "none",
} as CSSProperties;

const WEEKDAY = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const MONTH = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];

export default async function InflationDesignPreview() {
  const meta = META.cpi;
  const [result, today] = await Promise.all([getCpi(), getToday()]);
  if (!result.ok) return <DetailUnavailable meta={meta} error={result.error} />;

  const { series, monthlyFrom, categories, categoriesDate, nextRelease } = result.data;
  const snap = snapshot(meta, series)!;
  const now = snap.current.value;
  const last = snap.current.date;
  const fmt = (v: number) => formatValue(v, meta.format);
  const status = statusFor(meta.key, now, series, last);
  const insights = buildInsights(meta, series);

  const decade = between(series, addYears(last, -10), last);
  const tenYears = windowStats(decade)!;
  const inTarget = decade.filter((p) => p.value >= 2 && p.value <= 3).length / (decade.length || 1);
  const avg = decade.reduce((s, p) => s + p.value, 0) / (decade.length || 1);
  const where = now > 3 ? "above" : now < 2 ? "below" : "inside";

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

  const release = nextRelease ? new Date(`${nextRelease}T00:00:00`) : undefined;

  return (
    <div style={DS} className="type-calm min-h-screen bg-chip p-2 sm:p-6 lg:p-10">
      <div className="mx-auto max-w-[1360px] overflow-hidden rounded-[40px] bg-canvas">
        {/* -------------------------------------------------------- top band */}
        <div className="bg-inset px-5 pt-6 pb-10 sm:px-10 sm:pt-10 sm:pb-14">
          <header className="flex flex-wrap items-center gap-3 sm:gap-4">
            <Link href="/" aria-label="All indicators" className="grid size-14 place-items-center rounded-full bg-canvas transition-colors hover:text-accent">
              <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M15 6l-6 6 6 6" />
              </svg>
            </Link>
            <span className="grid size-14 place-items-center rounded-full bg-ink text-[13px] font-semibold text-canvas">CPI</span>
            <p className="text-[19px] leading-tight font-medium">
              Inflation
              <span className="block text-faint">{meta.group}</span>
            </p>
            <div className="ml-auto flex items-center gap-3">
              <span className="hidden items-center gap-3 md:flex">
                <span className="grid size-14 place-items-center rounded-full border border-chip text-[11px] font-semibold">ABS</span>
                <span className="text-sm leading-tight font-medium">
                  Australian Bureau of Statistics
                  <span className="block font-normal text-muted">Official figures, refreshed every few hours</span>
                </span>
              </span>
              <span className="grid size-14 place-items-center rounded-full border border-chip [&>button]:bg-transparent">
                <ThemeToggle />
              </span>
            </div>
          </header>

          <div className="mt-10 grid items-center gap-8 sm:mt-14 lg:grid-cols-[auto_1fr]">
            <div className="flex flex-wrap items-center gap-4">
              <span className="grid size-24 place-items-center rounded-full border border-chip text-[34px] font-normal tabular-nums">
                {release ? release.getDate() : last.slice(8, 10)}
              </span>
              <p className="text-[17px] leading-tight font-medium">
                {release ? (
                  <>
                    {WEEKDAY[release.getDay()]},
                    <span className="block">{MONTH[release.getMonth()]}</span>
                    <span className="mt-1 block text-xs font-normal text-muted">next update</span>
                  </>
                ) : (
                  fmtMonth(last)
                )}
              </p>
              <span className="mx-2 hidden h-12 w-px bg-chip sm:block" />
              <a href="#history" className="flex items-center gap-6 rounded-full bg-accent py-4 pr-5 pl-7 text-sm font-medium text-white transition hover:brightness-105">
                See the history
                <span aria-hidden="true">→</span>
              </a>
            </div>
            <h1 className="max-w-3xl text-[34px] leading-[1.1] font-medium tracking-tight sm:text-[48px] lg:ml-auto lg:text-right">
              Prices are up {fmt(now)} a year.
              <span className="block text-faint">That&apos;s {where} the 2–3% target.</span>
            </h1>
          </div>
        </div>

        {/* ------------------------------------------------------------ grid */}
        <main className="grid gap-4 px-3 py-4 sm:px-6 sm:py-6 lg:grid-cols-12">
          {/* the number, like the reference's card panel */}
          <Grey className="flex flex-col p-2.5 lg:col-span-5">
            <White className="p-6">
              <div className="flex items-center justify-between gap-3">
                <p className="text-[15px] font-semibold tracking-tight">Annual inflation</p>
                <Pill>
                  Latest · <span className="text-ink">{fmtMonth(last)}</span>
                </Pill>
              </div>
              <p className="mt-7 text-xs text-muted">Compared with a year earlier</p>
              <p className="mt-1 text-[56px] leading-none font-normal tracking-tight tabular-nums">
                {now.toFixed(1)}
                <span className="text-accent">%</span>
              </p>
              <div className="mt-6 flex flex-wrap gap-2">
                {status && <span className="rounded-full bg-ink px-5 py-2 text-sm text-canvas">{status.text}</span>}
                {snap.change !== undefined && (
                  <span className="rounded-full bg-inset px-5 py-2 text-sm tabular-nums">{formatSigned(snap.change, "pp")} vs last month</span>
                )}
              </div>
            </White>
            <div className="mt-auto flex items-end justify-between gap-4 px-5 pt-6 pb-3">
              <div>
                <p className="text-xs text-muted">10-year average</p>
                <p className="mt-1 text-[22px] font-normal tabular-nums">
                  {avg.toFixed(1)}
                  <span className="text-accent">%</span>
                </p>
              </div>
              <a href="#target" className="flex items-center gap-2.5 text-xs leading-tight font-medium text-accent">
                <span className="grid size-7 place-items-center rounded-full bg-accent text-white">
                  <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                    <path d="M5 11l6-6M6 5h5v5" />
                  </svg>
                </span>
                Check it
                <br />
                against the target
              </a>
            </div>
          </Grey>

          {/* key facts */}
          <Grey className="p-2.5 lg:col-span-7">
            <Head icon={GLYPH.facts} title="Key facts" pill="compared with today" />
            <White className="mt-1">
              <InsightGrid insights={insights} />
            </White>
          </Grey>

          {/* target */}
          <Grey id="target" className="scroll-mt-6 p-2.5 lg:col-span-12">
            <Head icon={GLYPH.target} title="How hot are prices?" pill="vs the RBA's target" />
            <p className="px-4 pb-4 text-xs leading-5 text-muted">
              The green band is the 2–3% the Reserve Bank aims for. The shaded strip is where inflation has been over the past ten years.
            </p>
            <White className="p-6">
              <TargetScale
                value={now}
                band={[2, 3]}
                range={{ low: tenYears.low.value, high: tenYears.high.value, label: "past 10 years" }}
                format={(v) => `${Number(v.toFixed(1))}%`}
                inTarget={inTarget}
              />
            </White>
          </Grey>

          {/* history */}
          <Grey id="history" className="scroll-mt-6 p-2.5 lg:col-span-12">
            <Head icon={GLYPH.chart} title="History" pill="annual change" />
            <White className="p-5 sm:p-7">
              <HistoryChart
                ranges={buildRanges(meta, series, { end: today, monthlyFrom })}
                format={meta.format}
                frequency={meta.frequency}
                polarity={meta.polarity}
                changeUnit={meta.changeUnit}
                band={{ from: 2, to: 3, label: "The Reserve Bank's 2–3% target band" }}
                quarterlyBefore={monthlyFrom}
                zeroLine
                defaultRange="all"
              />
            </White>
          </Grey>

          {/* past year: its own card already, sat white inside the grey */}
          <Grey className="flex flex-col p-2.5 lg:col-span-5 [&_section]:flex-1 [&_section]:rounded-[24px]">
            <Head icon={GLYPH.calendar} title="Month by month" pill="past 12 months" />
            <PastYearStats meta={meta} points={pastYear(series).filter((p) => p.date >= monthlyFrom)} full />
          </Grey>

          {/* categories */}
          <Grey className="p-2.5 lg:col-span-7">
            <Head icon={GLYPH.tag} title="Annual price change by category" pill={categoriesDate ? fmtMonth(categoriesDate) : undefined} />
            <White className="p-6">
              <CategoryBars items={categories} reference={{ value: now, label: `All items ${fmt(now)}` }} />
            </White>
          </Grey>

          {/* ten years */}
          <Grey className="p-2.5 lg:col-span-12">
            <Head icon={GLYPH.chart} title="Ten years of inflation" pill="annual change, by year" />
            <p className="px-4 pb-4 text-xs leading-5 text-muted">Each row is a year. The dot is its average, the grey bar runs from its lowest to its highest reading.</p>
            <White className="p-6">
              <YearsVsTarget years={years} band={[2, 3]} format={(v) => (Number.isInteger(v) ? `${v}%` : `${v.toFixed(1)}%`)} />
            </White>
          </Grey>
        </main>

        <div className="px-4 pb-8 sm:px-8">
          <Sources ids={meta.sources} note="Official figures, refreshed every few hours" />
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------- design system ---- */

/** Outer surface: soft grey, large radius, flat. */
function Grey({ children, className = "", id }: { children: ReactNode; className?: string; id?: string }) {
  return (
    <section id={id} className={`min-w-0 rounded-[32px] bg-inset ${className}`}>
      {children}
    </section>
  );
}

/** Inner surface: white card nested in a grey one. */
function White({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <div className={`min-w-0 rounded-[24px] bg-canvas ${className}`}>{children}</div>;
}

/** Outline pill on white, like the reference's "Weekly ▾" chips. */
function Pill({ children }: { children: ReactNode }) {
  return <span className="inline-flex shrink-0 items-center gap-2 rounded-full border border-chip bg-canvas px-4 py-2 text-xs text-muted tabular-nums">{children}</span>;
}

/** Card header on the grey: white icon circle, title, outline pill. */
function Head({ icon, title, pill }: { icon: ReactNode; title: string; pill?: string }) {
  return (
    <div className="flex flex-wrap items-center gap-3 px-3.5 pt-3.5 pb-4">
      <span className="grid size-11 shrink-0 place-items-center rounded-full bg-canvas">
        <svg viewBox="0 0 24 24" className="size-5" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
          {icon}
        </svg>
      </span>
      <h2 className="flex-1 text-[17px] font-medium tracking-tight">{title}</h2>
      {pill && (
        <Pill>
          {pill}
          <span className="size-1.5 rounded-full bg-accent" aria-hidden="true" />
        </Pill>
      )}
    </div>
  );
}

const GLYPH = {
  facts: <path d="M4 6h16M4 12h10M4 18h13" />,
  target: (
    <>
      <circle cx="12" cy="12" r="8" />
      <circle cx="12" cy="12" r="3.5" />
    </>
  ),
  chart: <path d="M3 17l6-6 4 4 8-8M15 7h6v6" />,
  calendar: <path d="M4 6h16v14H4zM4 10h16M8 3v4M16 3v4" />,
  tag: <path d="M3.5 12.5V4h8.5l8.5 8.5-8.5 8.5zM8 8h.01" />,
};
