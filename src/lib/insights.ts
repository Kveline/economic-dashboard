import { toneFor, type IndicatorMeta, type Tone } from "./data/indicators";
import { fmtMonth, fmtPeriod, formatUnsigned, formatValue } from "./format";
import { addYears, type Point } from "./series";

export type InsightIcon = "calendar" | "history" | "average" | "record" | "rank" | "streak" | "streakDown";

/**
 * One key fact. `value` is the headline and must read on its own as plain
 * English ("Up 0.7pp", "Lowest in 13 months"); `label` is a short topic and
 * `detail` the supporting numbers. `meter` (0–1) draws a small position bar.
 */
export type Insight = {
  icon: InsightIcon;
  label: string;
  value: string;
  detail: string;
  tone: Tone;
  meter?: number;
};

/** Last point on or before `date`. */
function at(series: Point[], date: string): Point | undefined {
  let found: Point | undefined;
  for (const p of series) {
    if (p.date > date) break;
    found = p;
  }
  return found;
}

function addMonths(iso: string, months: number): string {
  const d = new Date(`${iso}T00:00:00Z`);
  d.setUTCMonth(d.getUTCMonth() + months);
  return d.toISOString().slice(0, 10);
}

/** "13 months", "5 years". */
function span(from: string, to: string): string {
  const months = Math.round((Date.parse(to) - Date.parse(from)) / (30.44 * 86_400_000));
  if (months >= 24) return `${Math.floor(months / 12)} years`;
  return `${months} ${months === 1 ? "month" : "months"}`;
}

const UNIT_WORD: Record<IndicatorMeta["frequency"], [string, string]> = {
  daily: ["day", "days"],
  monthly: ["month", "months"],
  quarterly: ["quarter", "quarters"],
  decisions: ["meeting", "meetings"],
};

/**
 * Six plain facts the history chart doesn't spell out: today against a year
 * and five years ago and the 10-year average, how long since it was this high
 * (or low), how it ranks in all the history, and its momentum.
 */
export function buildInsights(meta: IndicatorMeta, series: Point[]): Insight[] {
  const cur = series[series.length - 1];
  if (!cur || series.length < 3) return [];
  const fmt = (v: number) => formatValue(v, meta.format);
  const pct = meta.changeUnit === "%";
  const unit = pct ? "%" : "pp";
  const delta = (from: number) => (pct ? (cur.value / from - 1) * 100 : cur.value - from);
  const flat = (d: number) => Math.abs(d) < 0.05;
  /** "Up 0.7pp" / "Down 4.4%" / "No change" */
  const move = (d: number) => (flat(d) ? "No change" : `${d > 0 ? "Up" : "Down"} ${formatUnsigned(Math.abs(d), unit)}`);
  const period = (d: string) => fmtPeriod(d, meta.frequency);
  /** "in Sep 2025" / "on 7 Nov 2025" */
  const when = (d: string) => `${meta.frequency === "daily" || meta.frequency === "decisions" ? "on" : "in"} ${period(d)}`;
  const [one, many] = UNIT_WORD[meta.frequency];
  const out: Insight[] = [];

  // 1–2. A year and five years ago.
  for (const [years, label, icon] of [
    [1, "1 year ago", "calendar"],
    [5, "5 years ago", "history"],
  ] as const) {
    const then = at(series, addYears(cur.date, -years));
    if (!then || then.date === cur.date) continue;
    const d = delta(then.value);
    out.push({ icon, label, value: move(d), detail: `was ${fmt(then.value)} ${when(then.date)}`, tone: toneFor(meta.polarity, d) });
  }

  // 3. Against the 10-year average.
  const decade = series.filter((p) => p.date >= addYears(cur.date, -10));
  const avg = decade.reduce((s, p) => s + p.value, 0) / decade.length;
  const dAvg = delta(avg);
  out.push({
    icon: "average",
    label: "10-year average",
    value: flat(dAvg) ? "About average" : `${formatUnsigned(Math.abs(dAvg), unit)} ${dAvg > 0 ? "above" : "below"} average`,
    detail: `the average is ${fmt(avg)}`,
    tone: toneFor(meta.polarity, dAvg),
  });

  // 4. How long since it was this high (or low): the further-back of the two.
  const lastWhere = (test: (v: number) => boolean) => {
    for (let i = series.length - 2; i >= 0; i--) if (test(series[i].value)) return series[i];
    return undefined;
  };
  const above = lastWhere((v) => v > cur.value);
  const below = lastWhere((v) => v < cur.value);
  const highest = !above || (below !== undefined && above.date < below.date);
  const since = highest ? above : below;
  const word = highest ? "high" : "low";
  if (!since) {
    out.push({ icon: "record", label: `Record ${word}`, value: `${highest ? "Highest" : "Lowest"} on record`, detail: `since ${series[0].date.slice(0, 4)}`, tone: "neutral" });
  } else if (Date.parse(cur.date) - Date.parse(since.date) >= 183 * 86_400_000) {
    out.push({
      icon: "record",
      label: `Recent ${word}`,
      value: `${highest ? "Highest" : "Lowest"} in ${span(since.date, cur.date)}`,
      detail: `last this ${word}: ${fmtMonth(since.date)} (${fmt(since.value)})`,
      tone: "neutral",
    });
  } else {
    // Nothing notable: the 3-month change instead.
    const then = at(series, addMonths(cur.date, -3));
    if (then) {
      const d = delta(then.value);
      out.push({ icon: "record", label: "Past 3 months", value: move(d), detail: `was ${fmt(then.value)} ${when(then.date)}`, tone: toneFor(meta.polarity, d) });
    }
  }

  // 5. Was the latest move a big deal, or normal noise?
  const change = (i: number) => (pct ? (series[i].value / series[i - 1].value - 1) * 100 : series[i].value - series[i - 1].value);
  const twoYears = addYears(cur.date, -2);
  if (meta.frequency === "decisions") {
    // Most meetings change nothing, so count the moves instead.
    const year = series.filter((p, i) => i > 0 && p.date > addYears(cur.date, -1));
    const idx = year.map((p) => series.indexOf(p));
    const ups = idx.filter((i) => change(i) > 0.001).length;
    const downs = idx.filter((i) => change(i) < -0.001).length;
    const moves = ups + downs;
    out.push({
      icon: "rank",
      label: "Past year",
      value: moves === 0 ? "No moves in a year" : `${moves} ${moves === 1 ? "move" : "moves"} in the past year`,
      detail: `${ups} ${ups === 1 ? "rise" : "rises"}, ${downs} ${downs === 1 ? "cut" : "cuts"} · out of ${idx.length} ${idx.length === 1 ? one : many}`,
      tone: "neutral",
    });
  } else {
    const recentMoves: number[] = [];
    for (let i = 1; i < series.length; i++) if (series[i].date >= twoYears) recentMoves.push(Math.abs(change(i)));
    recentMoves.sort((a, b) => a - b);
    const typical = recentMoves[Math.floor(recentMoves.length / 2)] ?? 0;
    const last = change(series.length - 1);
    const ratio = typical > 0 ? Math.abs(last) / typical : 0;
    const digits = pct ? (typical < 0.1 ? 2 : 1) : 1;
    const typicalText = `±${formatUnsigned(typical, unit, digits)}`;
    // The latest change spans a hole in daily data (gold): describe the usual size instead.
    const gap = meta.frequency === "daily" && Date.parse(cur.date) - Date.parse(series[series.length - 2].date) > 10 * 86_400_000;
    out.push(
      gap
        ? { icon: "rank", label: "Typical move", value: `Moves about ${typicalText} a ${one}`, detail: "the usual daily change, past 2 years", tone: "neutral" }
        : {
            icon: "rank",
            label: "Latest move",
            value: flat(last) && !pct ? `No change this ${one}` : ratio >= 1.6 ? "Bigger move than usual" : ratio <= 0.5 ? "A smaller move than usual" : "A normal-sized move",
            detail: flat(last) && !pct ? `a typical ${one} moves ${typicalText}` : `${move(last).toLowerCase()} · a typical ${one} moves ${typicalText}`,
            tone: "neutral",
          },
    );
  }

  // 6. Momentum.
  if (meta.frequency === "daily") {
    const then = at(series, addMonths(cur.date, -1));
    if (then && then.date >= addMonths(cur.date, -2)) {
      const d = delta(then.value);
      out.push({ icon: d < 0 ? "streakDown" : "streak", label: "Past month", value: move(d), detail: `was ${fmt(then.value)} ${when(then.date)}`, tone: toneFor(meta.polarity, d) });
    } else {
      // Gap in the data: distance from the 12-month peak instead.
      const year = series.filter((p) => p.date >= addYears(cur.date, -1));
      const hi = year.reduce((a, b) => (b.value > a.value ? b : a));
      const d = -delta(hi.value);
      out.push({
        icon: flat(d) ? "streak" : "streakDown",
        label: "12-month peak",
        value: flat(d) ? "At its peak" : `${formatUnsigned(d, unit, 0)} below its peak`,
        detail: `peak ${fmt(hi.value)} ${when(hi.date)}`,
        tone: "neutral",
      });
    }
    return out;
  }

  const diff = (i: number) => Number((series[i].value - series[i - 1].value).toFixed(4));
  const dir = Math.sign(diff(series.length - 1));
  let n = 0;
  for (let i = series.length - 1; i > 0 && Math.sign(diff(i)) === dir; i--) n++;
  if (n >= 2) {
    out.push({
      icon: dir < 0 ? "streakDown" : "streak",
      label: "Momentum",
      value: dir > 0 ? `Up ${n} ${many} in a row` : dir < 0 ? `Down ${n} ${many} in a row` : `Unchanged for ${n} ${many}`,
      detail: `latest ${fmt(cur.value)} ${when(cur.date)}`,
      tone: dir === 0 ? "neutral" : toneFor(meta.polarity, dir),
    });
  } else {
    let i = series.length - 1;
    while (i > 0 && diff(i) === 0) i--;
    if (i > 0) {
      const d = pct ? (series[i].value / series[i - 1].value - 1) * 100 : diff(i);
      const still = series.length - 1 - i;
      out.push({
        icon: d < 0 ? "streakDown" : "streak",
        label: "Last change",
        value: `${move(d)} in ${fmtMonth(series[i].date).slice(0, 3)}`,
        detail: still > 0 ? `unchanged since then (${still} ${still === 1 ? one : many})` : `from ${fmt(series[i - 1].value)}`,
        tone: toneFor(meta.polarity, d),
      });
    }
  }

  return out;
}
