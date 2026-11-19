# Simple Metrics Dashboard

The general condition of the Australian economy, in plain English, for a non-expert audience.

Six indicators: AUD/USD, gold (A$ per gram), the RBA cash rate, inflation (CPI), unemployment and GDP growth. The overview can be viewed as of now, 1, 5 or 10 years ago; each indicator has a detail page with a 5Y/10Y/All chart and a generated "What the chart shows" summary.

## Running

```bash
npm install
npm run dev
```

## Data sources

All fetching happens on the server and is cached with `"use cache"` (see the `sources` profile in `next.config.ts`, about 3 hours). A source that fails shows "temporarily unavailable" on its card only.

| Indicator | Source | Notes |
| --- | --- | --- |
| AUD/USD + other currencies | RBA [F11.1 CSV](https://www.rba.gov.au/statistics/tables/csv/f11.1-data.csv) | Covers 2023 onward. Older monthly history (2010–2022) is seeded from RBA `f11hist.xls`. RBA's CDN rejects browser-like User-Agents, so fetch without one. |
| Cash rate | RBA [cash rate page](https://www.rba.gov.au/statistics/cash-rate/) | Scraped for exact decision dates; falls back to F1.1 CSV (month-end only). Upcoming meetings are in `src/lib/data/calendar.ts`; update yearly. |
| Unemployment | ABS Data API `LF` | Seasonally adjusted, from 1990. |
| CPI | ABS Data API `CPI` 2.0.0 (monthly, Apr 2025–) + 1.1.0 (quarterly, to Sep qtr 2025) | Joined into one series. Categories use the 11 expenditure groups. |
| GDP | ABS Data API `ANA_AGG` | Annual growth derived from chain volume levels; also GDP per person, market sector GVA, real net national disposable income per person. |
| Gold | [gold-api.com](https://gold-api.com) (live, no key) + seeded USD history | Converted to A$/g using AUD/USD. |
| Next release dates | ABS release calendar | Only lists the next ~3 weeks, so a date may be missing. |

## Seeded history

`npm run seed` rebuilds `src/data/history/*.json`:

- `audusd.json`: monthly AUD/USD 2010–2022 from RBA's historical workbook.
- `gold-usd.json`: US$/oz from [freegoldapi.com](https://freegoldapi.com) (monthly to 2024, daily 2025 to Feb 2026). That dataset is not kept current. To fill the gap to today, put a [metalpriceapi.com](https://metalpriceapi.com) key in `.env.local` (see `.env.example`) and re-run `npm run seed`; it adds weekly prices.

## Layout

- `src/lib/data/`: source fetchers (`rba.ts`, `abs.ts`, `gold.ts`, `calendar.ts`) and `indicators.ts`, which turns them into one model per indicator.
- `src/lib/series.ts`, `format.ts`, `narrative.ts`, `view.ts`: series maths, formatting, the plain-English chart summaries, and view helpers.
- `src/app/`: overview (`page.tsx`) and one folder per detail page.
- `src/components/`: cards, charts (Recharts), range bar, tables.
