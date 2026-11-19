# Project context: Simple Metrics Dashboard

A read-only dashboard that explains the state of the Australian economy in plain English, for people who aren't economists. It covers six indicators, each with a card on the overview page and its own detail page. There are no accounts, no database and no API routes: every page is a server component that fetches public statistics, caches them and renders.

This file covers architecture, pages, data and conventions. It leaves out the visual design (colours, type, card styling).

---

## 1. Stack

| Thing | Version / note |
| --- | --- |
| Next.js | **16.4.5**, App Router, Turbopack. This version has breaking changes compared with older Next.js. Read `node_modules/next/dist/docs/` before writing Next-specific code (see `AGENTS.md`). |
| React | 19.3 (uses `use()`, `useTransition`, `useSyncExternalStore`) |
| Styling | Tailwind CSS v4 through `@tailwindcss/turbopack`, configured in `src/app/globals.css` (`@theme`). There is no `tailwind.config`. |
| Charts | Recharts 3 (only in `src/components/charts/TimeChart.tsx`). The other visuals are hand-built HTML/SVG. |
| Language | TypeScript strict. Path alias `@/*` → `src/*` |
| Font | Plus Jakarta Sans via `next/font/google` |
| Node | Developed on Node 24 |
| Dev-only | `xlsx` (SheetJS from its CDN tarball), used only by the seed script |
| Tests | None. Checks are `npx tsc --noEmit` and `npx eslint` |

Scripts (`package.json`): `dev`, `build`, `start`, `lint`, `seed` (`node scripts/seed-history.mjs`).

**Git:** the repo is initialised on `main` but has **no commits**. Everything is untracked.

---

## 2. Next.js configuration (`next.config.ts`)

- `cacheComponents: true`: turns on the `"use cache"` directive and Partial Prerendering.
- `partialPrefetching: true`.
- A custom cache profile **`sources`**: stale 1 h, revalidate 3 h, expire 2 days. All data fetchers use it.
- `turbopack.root = __dirname`, plus a rule that sends `*.css` through `@tailwindcss/turbopack`.

Caching model:
- Each loader in `src/lib/data/indicators.ts` is an `async` function marked `"use cache"` with `cacheLife("sources")`.
- `getToday()` (today's date in `Australia/Sydney`) is cached with `cacheLife("hours")`, so pages can prerender.
- The live gold spot price is cached with `cacheLife("hours")`.
- Route types come from Next's global `PageProps<"/">` / `LayoutProps<"/">` helpers. `searchParams` is a Promise and must be awaited.

---

## 3. Folder map

```
src/
  app/
    layout.tsx            root layout: font, metadata, viewport colours, inline theme script (light/dark before first paint)
    globals.css           Tailwind v4 theme and global CSS
    loading.tsx           skeleton for the overview
    page.tsx              overview "/" (time-travel view switcher)
    aud-usd/page.tsx      detail pages, one folder each
    gold/page.tsx
    cash-rate/page.tsx
    inflation/page.tsx
    unemployment/page.tsx
    gdp/page.tsx
    preview/              throwaway design experiments, safe to delete (see §9)
  components/
    Shell.tsx             page frame: top row, hero, content; HeroTitle, DetailHeading, LivePill, BackPill
    detail.tsx            detail-page building blocks: DetailPage, DetailUnavailable, Headline, InsightGrid, PastYearStats (+ internal MonthlyMoves)
    Facts.tsx             FactsPanel: "How it has moved" + "Where it sits" (combined key facts)
    home.tsx              overview card parts: HomeCard, BigValue, ChangeLine, Ring, StatusLine, Tile (indicator icon), Icons
    home-viz.tsx          overview visuals: CurveChart, CapsuleBars, FloatList, FloatRow
    viz.tsx               server-rendered visuals for detail pages (TargetScale, Waffle, LinedUp, PeriodBars, YearRanges, PriceBridge, InvestmentGrowth, RateStairs, …)
    viz-client.tsx        interactive client visuals: Converter (currency), Mortgage (repayment calculator), Heatmap
    charts/
      HistoryChart.tsx    client: 5Y/10Y/All switcher + pointer readout + optional "What the chart shows" story
      TimeChart.tsx       client: the Recharts line/step/area chart (bands, zero line, gap bridging, markers)
      ChartStory.tsx      client: renders a ChartStory (tiles + notes)
      MiniSpark.tsx       small sparkline (currently unused)
    ViewSwitcher.tsx      client: Today / 1 / 5 / 10 years ago segmented control (pushes ?view=)
    Pending.tsx           client: shared useTransition so cards dim while a new view loads
    ThemeToggle.tsx       client: light/dark toggle saved to localStorage
    Sources.tsx           "Where the numbers come from" footer
    CategoryBars.tsx      CPI by expenditure group
    Segmented.tsx, InfoTip.tsx, motion.tsx (AnimatedNumber, useReducedMotion), ui.tsx (Card, CardTitle, Stat, Table, Unavailable, toneClass), RangeBar.tsx
  lib/
    data/
      indicators.ts       THE model: META for each indicator, loaders getX(), snapshot(), toneFor()
      rba.ts              RBA CSV parser, exchange rates, cash rate table, scraped rate decisions
      abs.ts              ABS Data API (SDMX-JSON) fetch + flatten + pick()
      gold.ts             seeded USD gold history + live spot price
      calendar.ts         RBA Board decision dates (hard-coded) + scraped ABS release calendar
      fetch.ts            fetchText / fetchJson (throw on non-2xx)
    series.ts             Point type, date maths, indexAt/valueAt/between, windowStats, yoy
    format.ts             value formats, signed changes, date labels
    view.ts               buildRanges (chart windows), pastYear, changeLabel, rateStatus, step-series helpers
    narrative.ts          describeChart → ChartStory (plain-English chart summary)
    insights.ts           buildInsights → six "key facts" for the older tile grid
    status.ts             statusFor / cashRateStatus → one-glance verdict badge
    brief.ts              buildBrief / headline → one-sentence summary per indicator for the overview hero
    heat.ts               year × month grid helper (currently unused)
  data/history/
    audusd.json           seeded monthly AUD/USD 2010-01 → 2022-12 (156 points)
    gold-usd.json         seeded US$/oz 2000-01 → 2026-02-20 (587 points)
scripts/
  seed-history.mjs        rebuilds src/data/history/*.json
```

Client components (`"use client"`): ViewSwitcher, Pending, ThemeToggle, Segmented, InfoTip, motion, viz-client, charts/HistoryChart, charts/TimeChart, charts/ChartStory. Everything else renders on the server.

---

## 4. Data layer

### 4.1 Core types (`lib/series.ts`, `lib/data/indicators.ts`)

```ts
type Point = { date: string /* ISO yyyy-mm-dd */; value: number };
type Frequency = "daily" | "monthly" | "quarterly" | "decisions";
type IndicatorKey = "audusd" | "gold" | "cash-rate" | "cpi" | "unemployment" | "gdp";
type Polarity = "up-good" | "up-bad" | "neutral";      // drives good/bad colouring of changes
type ValueFormat = "fx" | "aud-gram" | "pct1" | "pct2";
type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };
```

Every series is a sorted `Point[]`. Monthly ABS periods are dated the 1st of the month. Quarterly periods are dated the **1st of the quarter's last month** (`2026-Q2` → `2026-06-01`, shown as "Jun qtr 2026").

`META: Record<IndicatorKey, IndicatorMeta>` holds per-indicator settings: title, plain name, group label, href, format, frequency, polarity, `changeUnit` (`"%"` or `"pp"`), `publishLagDays` (used by the overview's past views), source ids, and an explainer sentence.

| Key | Route | Format | Frequency | Polarity | Change unit | Publish lag |
| --- | --- | --- | --- | --- | --- | --- |
| audusd | /aud-usd | fx (0.6543) | daily | neutral | % | 0 |
| gold | /gold | aud-gram (A$123.45) | daily | neutral | % | 0 |
| cash-rate | /cash-rate | pct2 (3.60%) | decisions | up-bad (colour only) | pp | 0 |
| cpi | /inflation | pct1 | monthly | up-bad | pp | 57 days |
| unemployment | /unemployment | pct1 | monthly | up-bad | pp | 48 days |
| gdp | /gdp | pct1 | quarterly | up-good | pp | 95 days |

### 4.2 Loaders

Each public loader is `getX = () => load(loadXData)`. `load()` catches errors and returns `Loaded<T>`, so one failing source shows "temporarily unavailable" on its own card without breaking the page.

| Loader | Returns | Built from |
| --- | --- | --- |
| `getAudUsd()` | `{ series, crosses[] }` | Seeded monthly history (before 2023) joined to the live RBA F11.1 daily `FXRUSD`. `crosses` = latest rate + 12-month % change for USD, EUR, GBP, JPY, CNY, NZD (`CROSS_RATES`). |
| `getGold()` | `{ series (A$/g), usdPerOz, audUsd }` | US$/oz (seeded history + today's live spot) ÷ AUD/USD on that date ÷ 31.1034768 g. |
| `getCashRate()` | `{ series, decisions[] }` | Scraped RBA cash-rate page (every decision since 1990, effective dates). If scraping fails, falls back to F1.1 CSV `FIRMMCRT` (month-end only) and derives decisions from changes. `RateDecision = { date, change (pp), rate }`. |
| `getCpi()` | `{ series, monthlyFrom, categories[], categoriesDate, nextRelease }` | ABS `CPI 1.1.0` quarterly annual % change (to Sep qtr 2025) joined to `CPI 2.0.0` monthly (Apr 2025 onwards). Quarterly points are used only before `monthlyFrom`. `categories` = 11 expenditure groups at the latest month, sorted high→low. |
| `getUnemployment()` | `{ series, nextRelease }` | ABS `LF` seasonally adjusted rate, persons 15+, from 1990, rounded to 1 dp to match published figures. |
| `getGdp()` | `{ series, quarterly, level, livingStandards, alsoInRelease[], nextRelease }` | ABS `ANA_AGG` chain-volume GDP from 1989. `series` = through-the-year growth (`yoy(level, 4)`), `quarterly` = q/q %, `livingStandards` = real net national disposable income per person y/y, `alsoInRelease` = q/q % for GDP, GDP per person, domestic final demand, market sector GVA, real income per person. |
| `getToday()` | `"yyyy-mm-dd"` | Sydney date, cached hourly. |

### 4.3 External sources

| Source | URL / query | Notes |
| --- | --- | --- |
| RBA F11.1 exchange rates | `https://www.rba.gov.au/statistics/tables/csv/f11.1-data.csv` | Covers 2023 onwards. **The RBA CDN returns 403 for browser-like User-Agents, so don't set one** (Node's default fetch works). CSV has ~10 metadata rows; the `Series ID,` row names columns. Dates look like `05-Nov-2026`. |
| RBA F1.1 cash rate | `.../csv/f1.1-data.csv` (`FIRMMCRT`) | Fallback only. Dates look like `31/10/2026`. |
| RBA cash rate page | `https://www.rba.gov.au/statistics/cash-rate/` | HTML table scraped with regex. Old rows give ranges like "17.00 to 17.50"; the upper bound is taken. |
| RBA historical workbook | `https://www.rba.gov.au/statistics/tables/xls-hist/f11hist.xls` | Seed script only. |
| ABS Data API | `https://data.api.abs.gov.au/rest/data/{query}?startPeriod=…&dimensionAtObservation=AllDimensions` with `Accept: application/vnd.sdmx.data+json` | `fetchAbs()` flattens SDMX-JSON into `{ dims, date, value }`; `pick(obs, filter)` selects one series by dimension codes. |
| ABS release calendar | `https://www.abs.gov.au/release-calendar/future-releases` | Scraped for the next Labour Force, CPI and National Accounts dates. Only covers ~3 weeks ahead, so a date may be missing. Errors return `{}`. |
| gold-api.com | `https://api.gold-api.com/price/XAU` | Live US$/oz, no key. |
| freegoldapi.com | `https://freegoldapi.com/data/latest.json` | Seed script only. Not kept current: monthly to 2024, daily 2025 to 20 Feb 2026. |
| metalpriceapi.com | `https://api.metalpriceapi.com/v1/{date}` | Optional, seed script only, needs `METALPRICE_API_KEY` in `.env.local`. Adds weekly points after the freegoldapi data ends. |

ABS queries in use:
- CPI monthly: `ABS,CPI,2.0.0/3..10.50.M` from `2024-01` (`INDEX 10001` = all groups; group codes in `CPI_GROUPS`).
- CPI quarterly: `ABS,CPI,1.1.0/3.10001.10.50.Q` from `1990-Q1`.
- Unemployment: `ABS,LF,1.0.0/M13.3.1599.20.AUS.M` from `1990-01`.
- GDP: `ABS,ANA_AGG,1.0.0/M1+M2.GPM+GPM_PCA+DFD+GVA_MKT+NNDI_PCA.20.AUS.Q` from `1989-Q1` (M1 = chain volume level, M2 = q/q % change).

### 4.4 Seeded history (`npm run seed`)

`scripts/seed-history.mjs` writes `src/data/history/audusd.json` (RBA workbook, monthly, before 2023) and `gold-usd.json` (freegoldapi from 2000, plus metalpriceapi weekly fill when a key is set). Both files are `[[date, value], …]` and are imported directly as JSON modules.

**Known gap:** the committed gold history ends 2026-02-20, and live spot only adds today's price. So gold has **no stored prices from 20 Feb 2026 until today**. The chart draws that stretch dashed with a note ("No stored prices between …"), and FactsPanel skips look-backs that land in the hole. Running the seed with a metalpriceapi key fills it.

### 4.5 Hard-coded data that needs upkeep

- `RBA_DECISION_DATES` in `lib/data/calendar.ts`: Board announcement dates for 2026–2027. **Update once a year** from rba.gov.au/schedules-events/board-meeting-schedules.html.
- `CROSS_RATES` (indicators.ts), `CPI_GROUPS` (indicators.ts), `GDP_RELEASE_ITEMS` (indicators.ts), `RELEASE_NOTES` (gdp/page.tsx), `LEAD` / `CONTEXT` sentences (narrative.ts), `SOURCES` (Sources.tsx).

### 4.6 Derived logic (lib)

- **`snapshot(meta, series, asOf?)`** → `{ current, previous, change, tone }`. With `asOf`, it picks the latest point that was **published** by that date (`asOf − publishLagDays`). Change is % or pp according to `changeUnit`.
- **`toneFor(polarity, change)`** → good / bad / neutral.
- **`statusFor(key, value, series, date)`**: CPI vs the 2–3% target; unemployment vs its 10-year average (±0.15pp counts as "near"); GDP shrinking (<0) / slow (<1.5) / growing. **`cashRateStatus`**: "On hold" if the last move was over 120 days ago, else "Raised/Cut in <month>".
- **`rateStatus(decisions, asOf)`**: "Unchanged N months" or "Raised 0.25pp on 4 Nov".
- **`buildRanges(meta, series, { end, monthlyFrom })`** → `{ "5y", "10y", all }`, each `{ points, story }`. Step series (cash rate) are carried forward to `end` and start with the value in force at the window start.
- **`describeChart`** (narrative.ts) → `ChartStory`: lead, span, start/end/low/high, overall change, an indicator-specific extra (CPI share of readings in target; cash-rate counts of rises/cuts/holds), context sentence, notes (CPI quarterly→monthly switch; gaps over 45 days in daily data), and a full `text` for screen readers.
- **`buildInsights`** (insights.ts) → six facts (vs 1 year / 5 years, 10-year average, record or "highest in N months", rank in history, typical/latest move, momentum/streak).
- **`buildBrief` / `headline`** (brief.ts) → one sentence each for cash rate, prices, jobs, economy and dollar as of the viewed date. The hero shows a recent rate move first, then inflation outside target, then the first item.
- **Formatting** (format.ts): `formatValue`, `formatSigned` (true minus sign, `+0.25pp`), `fmtDay` "4 Nov 2026", `fmtDayShort` "4 Nov", `fmtMonth` "Nov 2026", `fmtQuarter` "Sep qtr 2026", `fmtPeriod(date, frequency)`, `fmtMoney`, `inDays`, `valueParts` (big-number prefix/suffix/digits).

---

## 5. Pages

All pages are async server components. A detail page fetches its own loader plus `getToday()`. If the loader fails, it returns `<DetailUnavailable>`. Page `<title>` comes from `export const metadata`, formatted "<Name> · Simple Metrics Dashboard".

### 5.1 Overview `/` (`app/page.tsx`)

- **Time travel:** `?view=now|1y|5y|10y`. `asOf = today − N years`. Every card uses `snapshot(meta, series, asOf)`, so it shows what was **published** by then. `ViewSwitcher` pushes the URL inside a shared transition (`PendingProvider`/`PendingArea`) so the cards dim while loading.
- Loads all six loaders in parallel.
- Top row: date badge + view switcher; "Live data" pill (or "Back to today" in past views); theme toggle.
- Hero: "Australia's economy, today." plus the `headline()` sentence, linked to its detail page.
- Cards (grid):
  1. **Australian dollar** (wide): big rate, change vs previous day, 12-month curve chart.
  2. **Cash rate**: rate, status line, last 8 decisions as capsule bars, ring counting down to the next Board decision (in past views: months since the last change).
  3. **Gold**: A$/g, change, 12-month curve.
  4. **Prices, jobs & growth** (wide): CPI, unemployment and GDP rows, each with value, period, next release date, status badge and a 2–3 year mini trend.
- Footer: data sources, plus freshness note ("refreshed every few hours" or "Showing figures published by <date>").

### 5.2 Shared detail-page frame

`DetailPage` (detail.tsx) wraps `Shell` with a back pill, the indicator icon, group label, name and explainer, then the page's cards, then the `Sources` footer for that indicator.

Detail building blocks:
- **`Headline`**: the latest value card (big number, period, note, status badge, change vs previous, a date line). Its right side shows key facts: either `InsightGrid` (six text tiles from `buildInsights`, the default `facts="tiles"`) or **`FactsPanel`** (`facts="combined"`).
- **`FactsPanel`** (Facts.tsx): "How it has moved" (bars for the change over the shortest period, 3 months, 1 year, 5 years; the shortest is 30 days for daily/decision data, 1 month for monthly, none for quarterly; 3- and 10-year rows fill in when readings are missing) and "Where it sits" (difference from the 10-year average, plus low–high strips for the past 12 months and 10 years with the average and today marked).
- **`HistoryChart`**: the main chart with a 5Y/10Y/All switcher. When a range includes a `story`, it also renders "What the chart shows" (ChartStory). Pages using the newer layout pass ranges **without** `story` and show only the line (plus any notes such as the gold gap or the CPI quarterly/monthly switch).
- **`PastYearStats`**: "Past 12 months" card (net change, a mini chart and, with `full`, monthly moves as bars). The `range` prop hides its low–high strip when FactsPanel already shows it.

### 5.3 Detail pages, top to bottom

**`/aud-usd`** — Australian dollar
1. Headline (`facts="combined"`, date line "RBA 4pm rate").
2. Past 12 months (counted from the same year-ago reading as FactsPanel's "1 year") | **Travel money** converter (client: type an A$ amount and see it in USD/EUR/GBP/JPY/CNY/NZD).
3. History chart (line only).
4. **Stronger or weaker?**: 12-month change of the A$ against each currency (`CurrencyMoves`).
5. **The A$ year by year**: low/high/average per year for 10 years, in US cents (`YearRanges`).

**`/gold`** — Gold price (A$ per gram)
1. Headline (`facts="combined"`, "World price, converted to A$").
2. **Same price, other units**: per troy ounce, per kilogram, per ounce in US$.
3. History chart (line only) + gap note.
4. **What moved the price** (`PriceBridge`): splits the 12-month move into a world-gold-price part and a currency part. A$ gold = US$ gold ÷ AUD/USD, so in log terms the change splits exactly; the parts are scaled to the real % change. | **If you had bought A$1,000 of gold…** 1, 3, 5 and 10 years ago (`InvestmentGrowth`).

**`/cash-rate`** — Cash rate target
1. Custom headline card: rate, status ("Unchanged N months"), "Set by the Reserve Bank Board" + `FactsPanel`.
2. **Next decision**: countdown ring, date, "Announced 2:30pm Sydney time", next three meetings | **This cycle**: low of the last 6 years vs now, and every move since as up/down bars.
3. History chart (step shape, line only).
4. **Meeting by meeting**: last 12 decisions (`RateStairs`) | **Your mortgage** (client `Mortgage`): loan-size slider and presets, monthly repayment on a 30-year variable loan at cash rate + fixed margin, compared with a baseline (a year ago / before the last move / the cycle low), plus a trend line.

**`/inflation`** — Inflation (CPI, annual)
1. Headline (`facts="combined"`, date line "Next release <date>") + **How hot are prices?** (`TargetScale`: today against the 2–3% band and the 10-year range).
2. History chart (line only, 2–3% band, zero line, dashed before `monthlyFrom` because those points are quarterly) + note about the quarterly→monthly switch.
3. Past 12 months (`full`, `range={false}`, monthly readings only) | **Annual price change by category** (`CategoryBars`, 11 groups vs all items).
4. **Ten years of inflation**: each year's low/high/average against the target (`YearsVsTarget`).

**`/unemployment`** — Unemployment rate (still the older layout)
1. Headline (six-tile `InsightGrid`) + **Out of every 100 people** waffle chart with 10-year low/high.
2. History chart **with** "What the chart shows" story.
3. **Where today sits in history**: every month since 1990 sorted low→high with today marked (`LinedUp`) + average by decade.
4. Past 12 months (`full`).

**`/gdp`** — GDP growth (still the older layout)
1. Headline (six-tile `InsightGrid`, "vs last quarter's yearly figure") + **This quarter at a glance**: q/q growth vs typical quarter, size of the economy (A$b, last 8 quarters), living standards (real income per person).
2. History chart **with** story, zero line.
3. **Quarter by quarter**: q/q growth bars for 8 years with a typical-quarter line and COVID-19 shading + average annual growth by decade.
4. **Also in this release**: q/q change of the five release measures.

### 5.4 Current state of the "combined facts" treatment

Detail pages are being moved, one at a time, from the older layout (six text tiles + chart story) to the newer one (`facts="combined"` / `FactsPanel`, chart without story, each fact shown once, Past 12 months counted from the same year-ago reading):
- **Done:** `/aud-usd`, `/cash-rate`, `/gold`, `/inflation`.
- **Not yet:** `/unemployment`, `/gdp`.

Known overlaps still on the page: `/inflation`'s "How hot are prices?" repeats the current value and 10-year low/high shown in FactsPanel; `/gold`'s A$1,000 card overlaps FactsPanel's 1/3/5/10-year bars.

---

## 6. Rendering and client behaviour

- **Theme:** an inline script in `layout.tsx` sets `data-theme="light|dark"` on `<html>` before first paint (saved choice in `localStorage.theme`, otherwise the system preference, followed live). `ThemeToggle` writes or clears the saved choice. `suppressHydrationWarning` is on `<html>`.
- **Navigation:** only the overview's view switcher changes data, through `?view=`. Detail pages have no query parameters.
- **Loading:** `app/loading.tsx` shows a skeleton of the overview grid.
- **Errors:** loaders never throw to the page. Errors are logged on the server and shown as "temporarily unavailable" per card. The raw error message appears only in development.
- **Accessibility:** charts have `aria-label`s or screen-reader text (ChartStory `text`); the view switcher is a radiogroup with arrow-key support; animations respect `prefers-reduced-motion` (`useReducedMotion`).

---

## 7. Environment and running

```bash
npm install
npm run dev            # http://localhost:3000 by default
npm run build && npm start
npm run seed           # optional: refresh src/data/history/*.json
```

- `.env.example` lists one optional variable, `METALPRICE_API_KEY`, used only by `npm run seed`. The app needs **no secrets** at runtime.
- All network calls go to public endpoints from the server. The host must allow outbound HTTPS to rba.gov.au, data.api.abs.gov.au, abs.gov.au and api.gold-api.com.
- On the original machine port 3000 was taken by another project, so this app was run on **3001** (`npx next dev -p 3001`).
- `.gitignore` ignores `.env*` (except `.env.example`), `.next`, `node_modules`, `*.tsbuildinfo` and `next-env.d.ts`.
- `AGENTS.md` is written by `next dev`; committing it keeps the tree clean.
- `.claude/settings.local.json` is local Claude Code permission config; don't carry it over.

---

## 8. Conventions

- **Plain English for non-experts.** Labels like "How it has moved", "Past 12 months", "Same price, other units". Sentences rather than jargon; explainers on every indicator.
- **Each fact once per page.** When a newer card shows a figure, remove it from older cards rather than repeat it, and make sure two cards counting "1 year" use the same starting reading.
- **True minus sign** (`−`) in all displayed numbers; cash rate changes use 2 decimals (`+0.25pp`), others 1.
- **Colour meaning follows polarity:** rising inflation/unemployment/cash rate reads "bad"; rising GDP reads "good"; AUD and gold are neutral but drawn up = good / down = bad in charts.
- **Server first.** Data work happens in server components and `lib/`; client components receive prepared points and stories.
- **Before Next-specific changes**, read the bundled docs in `node_modules/next/dist/docs/` (16.4.5 APIs differ from older versions).
- **Checks after a change:** `npx tsc --noEmit`, `npx eslint <paths>`, then open the page.

---

## 9. Leftovers and cleanup candidates

- **`src/app/preview/`** (`/preview/gold`, `/preview/inflation`, `/preview/inflation-design`): rejected design experiments, marked `robots: noindex`. Nothing links to them. Safe to delete the whole folder.
- **Unused exports** (defined but not used by any live page): in `viz.tsx` `DivergingBars`, `Waterfall`, `ValueBars`, `DecisionDots`, `ReleaseList`, `StepSpark`, `MeetingTimeline`; `Heatmap` in `viz-client.tsx`; `MiniSpark.tsx`; `RangeBar.tsx`; `Table`, `Stat`, `Eyebrow` in `ui.tsx`; `monthlyGrid` in `lib/heat.ts`.
- `public/*.svg` are the create-next-app defaults and aren't used.
- `README.md` is mostly accurate but still describes every detail page as having a "What the chart shows" summary; four of the six no longer do (§5.4).
