import { fmtPeriod, formatSigned, formatUnsigned, formatValue } from "./format";
import type { IndicatorKey, IndicatorMeta, Tone } from "./data/indicators";
import { toneFor } from "./data/indicators";
import { addYears, daysBetween, windowStats, type Point } from "./series";

const LEAD: Record<IndicatorKey, string> = {
  audusd: "How many US dollars one Australian dollar buys",
  gold: "The price of one gram of gold in Australian dollars",
  "cash-rate": "The Reserve Bank's cash rate target, the interest rate it sets for overnight loans between banks",
  cpi: "How much consumer prices rose compared with a year earlier",
  unemployment: "The share of people in the labour force who are looking for work, seasonally adjusted",
  gdp: "How much bigger Australia's economy was than a year earlier, after removing the effect of inflation",
};

const CONTEXT: Record<IndicatorKey, string> = {
  audusd:
    "A higher number means the Australian dollar buys more, which makes overseas travel and imported goods cheaper.",
  gold:
    "Gold is priced in US dollars worldwide, so a weaker Australian dollar also pushes up the local price.",
  "cash-rate":
    "When the cash rate goes up, mortgage and loan rates usually follow; when it comes down, borrowing gets cheaper.",
  cpi: "The Reserve Bank aims to keep inflation between 2% and 3% on average.",
  unemployment: "Lower is better: it means more of the people who want a job have found one.",
  gdp: "A negative figure means the economy produced less than a year earlier.",
};

export type RangeKey = "5y" | "10y" | "all";

/** A point on the chart with its display strings. */
export type StoryPoint = { date: string; value: number; valueText: string; when: string };

/**
 * Structured "What the chart shows": rendered as tiles and notes, with a
 * full-sentence `text` for screen readers.
 */
export type ChartStory = {
  lead: string;
  span: string;
  start: StoryPoint;
  end: StoryPoint;
  change: { text: string; direction: "up" | "down" | "flat"; tone: Tone };
  low: StoryPoint;
  high: StoryPoint;
  /** Indicator-specific extra, drawn as a small visual. */
  extra?: { kind: "band"; inside: number; label: string } | { kind: "moves"; ups: number; downs: number; holds: number };
  context: string;
  notes: string[];
  text: string;
};

function spanText(range: RangeKey, first: Point): string {
  if (range === "5y") return "Past five years";
  if (range === "10y") return "Past ten years";
  return `Since ${first.date.slice(0, 4)}`;
}

/** Plain-English summary of what a chart window shows. */
export function describeChart(
  meta: IndicatorMeta,
  points: Point[],
  range: RangeKey,
  extra?: { monthlyFrom?: string },
): ChartStory | undefined {
  const stats = windowStats(points);
  if (!stats) return undefined;
  // CPI before the monthly series started is quarterly.
  const label = (p: { date: string }) =>
    extra?.monthlyFrom && p.date < extra.monthlyFrom ? fmtPeriod(p.date, "quarterly") : fmtPeriod(p.date, meta.frequency);
  const fmt = (v: number) => formatValue(v, meta.format);
  const sp = (p: { date: string; value: number }): StoryPoint => ({ date: p.date, value: p.value, valueText: fmt(p.value), when: label(p) });

  const diff = meta.changeUnit === "%" ? ((stats.last.value - stats.first.value) / stats.first.value) * 100 : stats.last.value - stats.first.value;
  const flat = Math.abs(diff) < (meta.changeUnit === "%" ? 1 : 0.1);
  const change = {
    text: flat ? "little changed" : formatSigned(diff, meta.changeUnit, meta.changeUnit === "%" ? 0 : 1),
    direction: flat ? ("flat" as const) : diff > 0 ? ("up" as const) : ("down" as const),
    tone: flat ? ("neutral" as const) : toneFor(meta.polarity === "neutral" ? "up-good" : meta.polarity, diff),
  };

  let storyExtra: ChartStory["extra"];
  const sentences: string[] = [];

  if (meta.key === "cash-rate") {
    const moves = points.slice(1).map((p, i) => p.value - points[i].value);
    const ups = moves.filter((m) => m > 0).length;
    const downs = moves.filter((m) => m < 0).length;
    storyExtra = { kind: "moves", ups, downs, holds: moves.length - ups - downs };
    sentences.push(
      ups + downs === 0
        ? "The rate was not changed at all in this period."
        : `The rate was raised ${ups} ${ups === 1 ? "time" : "times"} and cut ${downs} ${downs === 1 ? "time" : "times"}.`,
    );
  }
  if (meta.key === "cpi") {
    const inside = points.filter((p) => p.value >= 2 && p.value <= 3).length / points.length;
    storyExtra = { kind: "band", inside, label: "of readings inside the 2–3% target" };
    sentences.push(`Inflation was inside the 2–3% target band in ${Math.round(inside * 100)}% of the readings shown.`);
  }

  const notes: string[] = [];
  if (meta.key === "cpi" && extra?.monthlyFrom && stats.first.date < extra.monthlyFrom) {
    notes.push(`Figures before ${fmtPeriod(extra.monthlyFrom, "monthly")} are quarterly; after that they are monthly.`);
  }
  // Flag gaps in daily data (e.g. gold history not seeded up to today).
  if (meta.frequency === "daily") {
    for (let i = points.length - 1; i > 0 && points[i].date >= addYears(stats.last.date, -1); i--) {
      if (daysBetween(points[i - 1].date, points[i].date) > 45) {
        notes.push(`No stored prices between ${fmtPeriod(points[i - 1].date, "daily")} and ${fmtPeriod(points[i].date, "daily")}.`);
        break;
      }
    }
  }

  const story: Omit<ChartStory, "text"> = {
    lead: LEAD[meta.key],
    span: `${spanText(range, stats.first)}, up to ${label(stats.last)}`,
    start: sp(stats.first),
    end: sp(stats.last),
    change,
    low: sp(stats.low),
    high: sp(stats.high),
    extra: storyExtra,
    context: CONTEXT[meta.key],
    notes,
  };

  const moveWords = flat ? "little changed overall" : `${diff > 0 ? "up" : "down"} ${formatUnsigned(diff, meta.changeUnit, meta.changeUnit === "%" ? 0 : 1)} overall`;
  const text = [
    `${story.lead}. ${story.span}.`,
    `It went from ${story.start.valueText} (${story.start.when}) to ${story.end.valueText} (${story.end.when}), ${moveWords}.`,
    `The low point was ${story.low.valueText} (${story.low.when}) and the high was ${story.high.valueText} (${story.high.when}).`,
    ...sentences,
    story.context,
    ...notes,
  ].join(" ");

  return { ...story, text };
}
