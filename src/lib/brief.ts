import type { BadgeTone } from "./status";
import type { AudUsdData, CashRateData, CpiData, GdpData, Loaded, UnemploymentData } from "./data/indicators";
import { META, snapshot } from "./data/indicators";
import { fmtDay, fmtPeriod, formatValue } from "./format";
import { addYears, daysBetween, valueAt } from "./series";

export type BriefItem = { key: string; label: string; text: string; tone: BadgeTone; href: string };

/**
 * "Where things stand": one plain-English sentence per indicator, as of the
 * viewed date. Indicators that failed to load are simply left out.
 */
export function buildBrief(
  data: {
    cash: Loaded<CashRateData>;
    cpi: Loaded<CpiData>;
    unemployment: Loaded<UnemploymentData>;
    gdp: Loaded<GdpData>;
    audusd: Loaded<AudUsdData>;
  },
  asOf: string | undefined,
  today: string,
): BriefItem[] {
  const items: BriefItem[] = [];
  const when = asOf ?? today;

  if (data.cash.ok) {
    const { decisions } = data.cash.data;
    const now = [...decisions].reverse().find((d) => d.date <= when);
    const lastMove = [...decisions].reverse().find((d) => d.date <= when && d.change !== 0);
    if (now && lastMove) {
      const rate = formatValue(now.rate, "pct2");
      const recent = daysBetween(lastMove.date, when) <= 75;
      items.push({
        key: "cash",
        label: "Interest rates",
        href: META["cash-rate"].href,
        tone: "accent",
        text: recent
          ? `The Reserve Bank ${lastMove.change > 0 ? "raised" : "cut"} the cash rate to ${rate} on ${fmtDay(lastMove.date)}.`
          : `The cash rate has been steady at ${rate} since ${fmtDay(lastMove.date)}.`,
      });
    }
  }

  if (data.cpi.ok) {
    const snap = snapshot(META.cpi, data.cpi.data.series, asOf);
    if (snap) {
      const v = snap.current.value;
      const where = v > 3 ? "above" : v < 2 ? "below" : "within";
      items.push({
        key: "cpi",
        label: "Prices",
        href: META.cpi.href,
        tone: where === "within" ? "good" : where === "above" ? "bad" : "warn",
        text: `Prices are ${v >= 0 ? "rising" : "falling"} ${formatValue(Math.abs(v), "pct1")} a year, ${where} the Reserve Bank's 2–3% target.`,
      });
    }
  }

  if (data.unemployment.ok) {
    const series = data.unemployment.data.series;
    const snap = snapshot(META.unemployment, series, asOf);
    if (snap) {
      const yearAgo = valueAt(series, addYears(snap.current.date, -1));
      const diff = yearAgo === undefined ? 0 : snap.current.value - yearAgo;
      const trend =
        yearAgo === undefined
          ? ""
          : Math.abs(diff) < 0.05
            ? ", the same as a year earlier"
            : `, ${diff > 0 ? "up" : "down"} from ${formatValue(yearAgo, "pct1")} a year earlier`;
      items.push({
        key: "unemployment",
        label: "Jobs",
        href: META.unemployment.href,
        tone: Math.abs(diff) < 0.05 ? "neutral" : diff > 0 ? "warn" : "good",
        text: `${formatValue(snap.current.value, "pct1")} of people in the labour force are looking for work${trend}.`,
      });
    }
  }

  if (data.gdp.ok) {
    const snap = snapshot(META.gdp, data.gdp.data.series, asOf);
    if (snap) {
      const v = snap.current.value;
      items.push({
        key: "gdp",
        label: "Economy",
        href: META.gdp.href,
        tone: v < 0 ? "bad" : v < 1.5 ? "warn" : "good",
        text: `The economy ${v >= 0 ? "grew" : "shrank"} ${formatValue(Math.abs(v), "pct1")} over the year to the ${fmtPeriod(snap.current.date, "quarterly")}.`,
      });
    }
  }

  if (data.audusd.ok) {
    const series = data.audusd.data.series;
    const snap = snapshot(META.audusd, series, asOf);
    if (snap) {
      const yearAgo = valueAt(series, addYears(snap.current.date, -1));
      const pct = yearAgo ? ((snap.current.value - yearAgo) / yearAgo) * 100 : undefined;
      items.push({
        key: "audusd",
        label: "Dollar",
        href: META.audusd.href,
        tone: "neutral",
        text:
          `One Australian dollar buys ${(snap.current.value * 100).toFixed(1)} US cents` +
          (pct === undefined || Math.abs(pct) < 0.5
            ? "."
            : `, ${Math.abs(pct).toFixed(1)}% ${pct > 0 ? "more" : "less"} than a year earlier.`),
      });
    }
  }

  return items;
}

/**
 * The single most newsworthy line for the hero: a recent rate move first,
 * then inflation outside its target, then whatever comes first.
 */
export function headline(items: BriefItem[]): BriefItem | undefined {
  const rateMove = items.find((i) => i.key === "cash" && /raised|cut/.test(i.text));
  const cpiOff = items.find((i) => i.key === "cpi" && i.tone !== "good");
  return rateMove ?? cpiOff ?? items[0];
}
