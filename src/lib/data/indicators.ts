import { cacheLife } from "next/cache";
import audUsdHistory from "@/data/history/audusd.json";
import type { ValueFormat } from "../format";
import {
  addDays,
  addYears,
  indexAt,
  periodChange,
  sortPoints,
  valueAt,
  yoy,
  type Frequency,
  type Point,
} from "../series";
import { fetchAbs, pick } from "./abs";
import { fetchAbsReleaseDates } from "./calendar";
import { fetchGoldUsd, GRAMS_PER_TROY_OUNCE } from "./gold";
import { fetchCashRateTable, fetchExchangeRates, fetchRateDecisions, type RateDecision } from "./rba";

export type IndicatorKey = "audusd" | "gold" | "cash-rate" | "cpi" | "unemployment" | "gdp";

export type Polarity = "up-good" | "up-bad" | "neutral";

export type SourceId = "rba" | "abs" | "goldapi" | "freegold";

export type IndicatorMeta = {
  key: IndicatorKey;
  title: string;
  /** Full, plain-English name, e.g. "Australian dollar". */
  name: string;
  /** Group label shown above the name, e.g. "Market · daily". */
  group: string;
  href: string;
  format: ValueFormat;
  frequency: Frequency;
  polarity: Polarity;
  /** How period-to-period change is expressed. */
  changeUnit: "%" | "pp";
  /** Rough days from a period's date until it's published (for past views). */
  publishLagDays: number;
  /** Where the figures come from (see components/Sources). */
  sources: SourceId[];
  /** One or two plain-English sentences for the "?" tip. */
  explainer: string;
};

export const META: Record<IndicatorKey, IndicatorMeta> = {
  audusd: {
    key: "audusd",
    title: "AUD/USD",
    name: "Australian dollar",
    group: "Market · daily",
    href: "/aud-usd",
    format: "fx",
    frequency: "daily",
    polarity: "neutral",
    changeUnit: "%",
    publishLagDays: 0,
    sources: ["rba"],
    explainer:
      "How many US dollars one Australian dollar buys. A higher number makes overseas holidays, online shopping from abroad and imported goods cheaper for Australians.",
  },
  gold: {
    key: "gold",
    title: "Gold",
    name: "Gold price",
    group: "Market · daily",
    href: "/gold",
    format: "aud-gram",
    frequency: "daily",
    polarity: "neutral",
    changeUnit: "%",
    publishLagDays: 0,
    sources: ["goldapi", "freegold", "rba"],
    explainer:
      "The world price of gold, converted to Australian dollars per gram. People often buy gold as a safe store of value when they are worried about the economy.",
  },
  "cash-rate": {
    key: "cash-rate",
    title: "Cash rate target",
    name: "Cash rate target",
    group: "Policy · set by the RBA",
    href: "/cash-rate",
    format: "pct2",
    frequency: "decisions",
    polarity: "up-bad", // colour only: a rise reads rose, a cut emerald, as on the rest of the page
    changeUnit: "pp",
    publishLagDays: 0,
    sources: ["rba"],
    explainer:
      "The interest rate the Reserve Bank of Australia sets. Banks use it as the base for mortgage, loan and savings rates, so changes flow through to household budgets.",
  },
  cpi: {
    key: "cpi",
    title: "Inflation (CPI, annual)",
    name: "Inflation (CPI, annual)",
    group: "Monthly statistics",
    href: "/inflation",
    format: "pct1",
    frequency: "monthly",
    polarity: "up-bad",
    changeUnit: "pp",
    publishLagDays: 57,
    sources: ["abs"],
    explainer:
      "How much the prices of everyday goods and services rose compared with a year earlier. The Reserve Bank tries to keep it between 2% and 3%.",
  },
  unemployment: {
    key: "unemployment",
    title: "Unemployment",
    name: "Unemployment rate",
    group: "Monthly statistics",
    href: "/unemployment",
    format: "pct1",
    frequency: "monthly",
    polarity: "up-bad",
    changeUnit: "pp",
    publishLagDays: 48,
    sources: ["abs"],
    explainer:
      "The share of people who want a job and are actively looking, but don't have one. Lower generally means a stronger jobs market.",
  },
  gdp: {
    key: "gdp",
    title: "GDP growth (annual)",
    name: "GDP growth (annual)",
    group: "Quarterly statistics",
    href: "/gdp",
    format: "pct1",
    frequency: "quarterly",
    polarity: "up-good",
    changeUnit: "pp",
    publishLagDays: 95,
    sources: ["abs"],
    explainer:
      "How much bigger the economy was than a year earlier, after removing the effect of rising prices. Positive means the economy is growing.",
  },
};

export type Loaded<T> = { ok: true; data: T } | { ok: false; error: string };

async function load<T>(fn: () => Promise<T>): Promise<Loaded<T>> {
  try {
    return { ok: true, data: await fn() };
  } catch (e) {
    console.error(e);
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  }
}

/** Today's date in Sydney (yyyy-mm-dd). Cached hourly so pages can prerender. */
export async function getToday(): Promise<string> {
  "use cache";
  cacheLife("hours");
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Australia/Sydney" }).format(new Date());
}

/* ------------------------------------------------------------------ FX ---- */

export const CROSS_RATES = [
  { id: "FXRUSD", name: "US dollar", code: "USD", symbol: "US$" },
  { id: "FXREUR", name: "Euro", code: "EUR", symbol: "€" },
  { id: "FXRUKPS", name: "UK pound", code: "GBP", symbol: "£" },
  { id: "FXRJY", name: "Japanese yen", code: "JPY", symbol: "¥" },
  { id: "FXRCR", name: "Chinese renminbi", code: "CNY", symbol: "¥" },
  { id: "FXRNZD", name: "New Zealand dollar", code: "NZD", symbol: "NZ$" },
] as const;

async function getRbaFx() {
  "use cache";
  cacheLife("sources");
  return fetchExchangeRates();
}

/** AUD/USD: seeded monthly history (2010–2022) + live daily CSV (2023–). */
async function getAudUsdSeries(): Promise<Point[]> {
  const live = (await getRbaFx()).FXRUSD ?? [];
  if (live.length === 0) throw new Error("RBA F11.1: no FXRUSD data");
  const history = (audUsdHistory as [string, number][])
    .map(([date, value]) => ({ date, value }))
    .filter((p) => p.date < live[0].date);
  return [...history, ...live];
}

export type AudUsdData = {
  series: Point[];
  crosses: { name: string; code: string; symbol: string; rate: number; change12m?: number; date: string }[];
};

export const getAudUsd = () => load(loadAudUsdData);

async function loadAudUsdData(): Promise<AudUsdData> {
  "use cache";
  cacheLife("sources");
  const [series, fx] = await Promise.all([getAudUsdSeries(), getRbaFx()]);
  const crosses = CROSS_RATES.flatMap(({ id, name, code, symbol }) => {
    const s = fx[id];
    if (!s?.length) return [];
    const last = s[s.length - 1];
    const yearAgo = valueAt(s, addYears(last.date, -1));
    return [
      {
        name,
        code,
        symbol,
        rate: last.value,
        date: last.date,
        change12m: yearAgo ? ((last.value - yearAgo) / yearAgo) * 100 : undefined,
      },
    ];
  });
  return { series, crosses };
}

/* ---------------------------------------------------------------- Gold ---- */

export type GoldData = {
  /** A$ per gram. */
  series: Point[];
  /** US$ per troy ounce. */
  usdPerOz: Point[];
  audUsd: Point[];
};

export const getGold = () => load(loadGoldData);

async function loadGoldData(): Promise<GoldData> {
  "use cache";
  cacheLife("sources");
  const [usdPerOz, audUsd] = await Promise.all([fetchGoldUsd(), getAudUsdSeries()]);
  const series: Point[] = [];
  for (const p of usdPerOz) {
    const fx = valueAt(audUsd, p.date);
    if (fx) series.push({ date: p.date, value: p.value / fx / GRAMS_PER_TROY_OUNCE });
  }
  if (series.length === 0) throw new Error("Gold: no data");
  return { series, usdPerOz, audUsd };
}

/* ----------------------------------------------------------- Cash rate ---- */

export type CashRateData = {
  /** One point per decision (effective date), including holds. */
  series: Point[];
  decisions: RateDecision[];
};

export const getCashRate = () => load(loadCashRateData);

async function loadCashRateData(): Promise<CashRateData> {
  "use cache";
  cacheLife("sources");
  let decisions: RateDecision[];
  try {
    decisions = await fetchRateDecisions();
  } catch (e) {
    // Fallback: derive decisions from the month-end F1.1 table.
    console.error(e);
    const table = await fetchCashRateTable();
    decisions = table.flatMap((p, i) => {
      const prev = table[i - 1];
      if (prev && prev.value === p.value) return [];
      return [{ date: p.date, rate: p.value, change: prev ? p.value - prev.value : 0 }];
    });
  }
  return {
    series: decisions.map((d) => ({ date: d.date, value: d.rate })),
    decisions,
  };
}

/* ----------------------------------------------------------------- CPI ---- */

/** The 11 CPI expenditure groups (monthly CPI dataflow INDEX codes). */
const CPI_GROUPS: Record<string, string> = {
  "20001": "Food, beverages",
  "20006": "Alcohol, tobacco",
  "20002": "Clothing, footwear",
  "20003": "Housing",
  "20004": "Furnishings, household",
  "115486": "Health",
  "20005": "Transport",
  "115488": "Communication",
  "115489": "Recreation, culture",
  "115493": "Education",
  "126670": "Insurance, finance",
};

export type CpiData = {
  series: Point[];
  /** First month of the monthly CPI; earlier points are quarterly. */
  monthlyFrom: string;
  categories: { name: string; value: number }[];
  categoriesDate?: string;
  nextRelease?: string;
};

export const getCpi = () => load(loadCpiData);

async function loadCpiData(): Promise<CpiData> {
  "use cache";
  cacheLife("sources");
  const [monthlyObs, quarterly, releases] = await Promise.all([
    // Annual % change, all CPI indexes, Australia, monthly (complete monthly CPI, Apr 2025–).
    fetchAbs("ABS,CPI,2.0.0/3..10.50.M", "2024-01"),
    // Annual % change, all groups, quarterly (discontinued after Sep qtr 2025).
    fetchAbs("ABS,CPI,1.1.0/3.10001.10.50.Q", "1990-Q1").then((o) => pick(o, {})),
    fetchAbsReleaseDates(),
  ]);
  const monthly = pick(monthlyObs, { INDEX: "10001" });
  if (monthly.length === 0) throw new Error("ABS CPI: no monthly data");
  const monthlyFrom = monthly[0].date;
  const series = [...quarterly.filter((p) => p.date < monthlyFrom), ...monthly];

  const latest = monthly[monthly.length - 1].date;
  const categories = Object.entries(CPI_GROUPS)
    .map(([code, name]) => ({ name, value: valueAt(pick(monthlyObs, { INDEX: code }), latest) }))
    .filter((c): c is { name: string; value: number } => c.value !== undefined)
    .sort((a, b) => b.value - a.value);

  return { series, monthlyFrom, categories, categoriesDate: latest, nextRelease: releases.cpi };
}

/* -------------------------------------------------------- Unemployment ---- */

export type UnemploymentData = { series: Point[]; nextRelease?: string };

export const getUnemployment = () => load(loadUnemploymentData);

async function loadUnemploymentData(): Promise<UnemploymentData> {
  "use cache";
  cacheLife("sources");
  const [obs, releases] = await Promise.all([
    // Unemployment rate, persons, 15+, seasonally adjusted, Australia, monthly.
    fetchAbs("ABS,LF,1.0.0/M13.3.1599.20.AUS.M", "1990-01"),
    fetchAbsReleaseDates(),
  ]);
  // The ABS publishes the rate to one decimal; round so changes match what's shown.
  const series = sortPoints(obs.map((o) => ({ date: o.date, value: Math.round(o.value * 10) / 10 })));
  if (series.length === 0) throw new Error("ABS LF: no data");
  return { series, nextRelease: releases["labour-force"] };
}

/* ----------------------------------------------------------------- GDP ---- */

const GDP_RELEASE_ITEMS: Record<string, string> = {
  GPM: "Gross domestic product",
  GPM_PCA: "GDP per person",
  DFD: "Domestic final demand",
  GVA_MKT: "Market sector GVA",
  NNDI_PCA: "Real income per person",
};

export type GdpData = {
  /** Annual growth, % (through-the-year, from chain volume levels). */
  series: Point[];
  quarterly: Point[];
  /** Chain volume GDP, A$ million. */
  level: Point[];
  /** Real net national disposable income per capita, annual % change. */
  livingStandards: Point[];
  alsoInRelease: { name: string; value: number }[];
  nextRelease?: string;
};

export const getGdp = () => load(loadGdpData);

async function loadGdpData(): Promise<GdpData> {
  "use cache";
  cacheLife("sources");
  const [obs, releases] = await Promise.all([
    fetchAbs(
      `ABS,ANA_AGG,1.0.0/M1+M2.${Object.keys(GDP_RELEASE_ITEMS).join("+")}.20.AUS.Q`,
      "1989-Q1",
    ),
    fetchAbsReleaseDates(),
  ]);
  const level = pick(obs, { MEASURE: "M1", DATA_ITEM: "GPM" });
  if (level.length < 5) throw new Error("ABS ANA_AGG: no GDP data");
  const latest = level[level.length - 1].date;
  const alsoInRelease = Object.entries(GDP_RELEASE_ITEMS)
    .map(([item, name]) => ({
      name,
      value: valueAt(pick(obs, { MEASURE: "M2", DATA_ITEM: item }), latest),
    }))
    .filter((r): r is { name: string; value: number } => r.value !== undefined);

  return {
    series: yoy(level, 4),
    quarterly: periodChange(level),
    level,
    livingStandards: yoy(pick(obs, { MEASURE: "M1", DATA_ITEM: "NNDI_PCA" }), 4),
    alsoInRelease,
    nextRelease: releases["national-accounts"],
  };
}

/* ------------------------------------------------------------ Snapshot ---- */

export type Tone = "good" | "bad" | "neutral";

export type Snapshot = {
  current: Point;
  previous?: Point;
  /** In the indicator's change unit (pp or %). */
  change?: number;
  tone: Tone;
};

export function toneFor(polarity: Polarity, change: number | undefined): Tone {
  if (change === undefined || polarity === "neutral" || Math.abs(change) < 1e-9) return "neutral";
  const up = change > 0;
  return (polarity === "up-good") === up ? "good" : "bad";
}

/**
 * The latest observation that was public on `asOf`, and the one before it.
 * For the current view pass `asOf` undefined to use the latest observation.
 */
export function snapshot(meta: IndicatorMeta, series: Point[], asOf?: string): Snapshot | undefined {
  const i = asOf === undefined ? series.length - 1 : indexAt(series, addDays(asOf, -meta.publishLagDays));
  if (i < 0) return undefined;
  const current = series[i];
  const previous = i > 0 ? series[i - 1] : undefined;
  let change: number | undefined;
  if (previous) {
    change =
      meta.changeUnit === "%"
        ? ((current.value - previous.value) / previous.value) * 100
        : current.value - previous.value;
  }
  return { current, previous, change, tone: toneFor(meta.polarity, change) };
}
