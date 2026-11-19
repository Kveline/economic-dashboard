import type { IndicatorMeta } from "./data/indicators";
import type { RateDecision } from "./data/rba";
import { fmtDay, fmtDayShort } from "./format";
import { describeChart, type ChartStory, type RangeKey } from "./narrative";
import { addYears, between, daysBetween, indexAt, type Point } from "./series";

/** "vs prev day" / "vs prev month" / "vs prev quarter", or "since 20 Feb 2026" for gaps. */
export function changeLabel(meta: IndicatorMeta, current: Point, previous: Point | undefined): string {
  if (!previous) return "";
  const gap = daysBetween(previous.date, current.date);
  if (meta.frequency === "daily") return gap <= 4 ? "vs prev day" : `since ${fmtDay(previous.date)}`;
  if (meta.frequency === "quarterly" || gap > 45) return "vs prev quarter";
  return "vs prev month";
}

/** Step series: carry the last value forward to `end` so the line reaches it. */
export function extendStep(points: Point[], end: string): Point[] {
  const last = points[points.length - 1];
  return last && last.date < end ? [...points, { date: end, value: last.value }] : points;
}

/** Points for a window ending at `end`, with the value in force at the start for step series. */
export function stepWindow(points: Point[], from: string, end: string): Point[] {
  const i = indexAt(points, from);
  const start = i >= 0 ? [{ date: from, value: points[i].value }] : [];
  return extendStep([...start, ...between(points, from, end)], end);
}

/** The three chart ranges for a detail page, each with its narrative. */
export function buildRanges(
  meta: IndicatorMeta,
  series: Point[],
  opts: { end: string; monthlyFrom?: string },
): Record<RangeKey, { points: Point[]; story?: ChartStory }> {
  const step = meta.frequency === "decisions";
  const lastDate = step ? opts.end : series[series.length - 1].date;
  const make = (key: RangeKey) => {
    let points: Point[];
    if (key === "all") points = step ? extendStep(series, opts.end) : series;
    else {
      const from = addYears(lastDate, key === "5y" ? -5 : -10);
      points = step ? stepWindow(series, from, opts.end) : between(series, from, lastDate);
    }
    return { points, story: describeChart(meta, points, key, { monthlyFrom: opts.monthlyFrom }) };
  };
  return { "5y": make("5y"), "10y": make("10y"), all: make("all") };
}

/** Last 12 months of observations up to the latest. */
export function pastYear(series: Point[]): Point[] {
  const last = series[series.length - 1];
  return between(series, addYears(last.date, -1), last.date);
}

/** Cash rate status line: "Unchanged 22 months" or "Raised 0.25pp on 4 Nov". */
export function rateStatus(decisions: RateDecision[], asOf: string): { text: string; lastChange?: RateDecision } {
  const upto = decisions.filter((d) => d.date <= asOf);
  const lastChange = [...upto].reverse().find((d) => d.change !== 0);
  if (!lastChange) return { text: "" };
  const days = daysBetween(lastChange.date, asOf);
  const months = Math.floor(days / 30.44);
  if (months >= 1) return { text: `Unchanged ${months} ${months === 1 ? "month" : "months"}`, lastChange };
  const verb = lastChange.change > 0 ? "Raised" : "Cut";
  return { text: `${verb} ${Math.abs(lastChange.change).toFixed(2)}pp on ${fmtDayShort(lastChange.date)}`, lastChange };
}
