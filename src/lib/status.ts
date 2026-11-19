import type { IndicatorKey } from "./data/indicators";
import type { RateDecision } from "./data/rba";
import { fmtMonth } from "./format";
import { addYears, between, daysBetween, type Point } from "./series";

export type BadgeTone = "good" | "bad" | "warn" | "neutral" | "accent";

/** What the status means, for its icon. */
export type StatusIcon = "up" | "down" | "within" | "near" | "rising" | "falling" | "hold";

export type Status = { text: string; tone: BadgeTone; icon: StatusIcon };

/** A one-glance verdict for an indicator's value at `date`. */
export function statusFor(key: IndicatorKey, value: number, series: Point[], date: string): Status | undefined {
  switch (key) {
    case "cpi":
      if (value > 3) return { text: "Above 2–3% target", tone: "bad", icon: "up" };
      if (value < 2) return { text: "Below 2–3% target", tone: "warn", icon: "down" };
      return { text: "Within 2–3% target", tone: "good", icon: "within" };
    case "unemployment": {
      const window = between(series, addYears(date, -10), date);
      if (window.length < 12) return undefined;
      const avg = window.reduce((s, p) => s + p.value, 0) / window.length;
      if (Math.abs(value - avg) < 0.15) return { text: "Near 10-year average", tone: "neutral", icon: "near" };
      return value < avg
        ? { text: "Below 10-year average", tone: "good", icon: "down" }
        : { text: "Above 10-year average", tone: "warn", icon: "up" };
    }
    case "gdp":
      if (value < 0) return { text: "Economy shrinking", tone: "bad", icon: "falling" };
      if (value < 1.5) return { text: "Growing slowly", tone: "warn", icon: "rising" };
      return { text: "Economy growing", tone: "good", icon: "rising" };
    default:
      return undefined;
  }
}

export function cashRateStatus(decisions: RateDecision[], asOf: string): Status | undefined {
  const last = [...decisions].reverse().find((d) => d.date <= asOf && d.change !== 0);
  if (!last) return undefined;
  if (daysBetween(last.date, asOf) > 120) return { text: "On hold", tone: "neutral", icon: "hold" };
  return last.change > 0
    ? { text: `Raised in ${fmtMonth(last.date)}`, tone: "bad", icon: "up" }
    : { text: `Cut in ${fmtMonth(last.date)}`, tone: "good", icon: "down" };
}
