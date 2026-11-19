/** A single observation. `date` is ISO yyyy-mm-dd. */
export type Point = { date: string; value: number };

export type Frequency = "daily" | "monthly" | "quarterly" | "decisions";

const DAY = 86_400_000;

export function toDate(iso: string): Date {
  return new Date(`${iso}T00:00:00Z`);
}

export function isoDate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

export function addDays(iso: string, days: number): string {
  return isoDate(new Date(toDate(iso).getTime() + days * DAY));
}

export function addYears(iso: string, years: number): string {
  const d = toDate(iso);
  d.setUTCFullYear(d.getUTCFullYear() + years);
  return isoDate(d);
}

export function addMonths(iso: string, months: number): string {
  const d = toDate(iso);
  d.setUTCMonth(d.getUTCMonth() + months);
  return isoDate(d);
}

export function daysBetween(a: string, b: string): number {
  return Math.round((toDate(b).getTime() - toDate(a).getTime()) / DAY);
}

export function sortPoints(points: Point[]): Point[] {
  return [...points].sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0));
}

/** Index of the last point on or before `date`, or -1. Points must be sorted. */
export function indexAt(points: Point[], date: string): number {
  let lo = 0;
  let hi = points.length - 1;
  let found = -1;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (points[mid].date <= date) {
      found = mid;
      lo = mid + 1;
    } else {
      hi = mid - 1;
    }
  }
  return found;
}

export function valueAt(points: Point[], date: string): number | undefined {
  const i = indexAt(points, date);
  return i >= 0 ? points[i].value : undefined;
}

/** Points with from < date <= to. */
export function between(points: Point[], from: string, to: string): Point[] {
  return points.filter((p) => p.date > from && p.date <= to);
}

export type Extreme = { value: number; date: string };

export type WindowStats = {
  high: Extreme;
  low: Extreme;
  mean: number;
  first: Point;
  last: Point;
  /** Largest absolute move between consecutive observations. */
  largestMove?: Extreme;
  /** Median absolute move between consecutive observations. */
  typicalMove?: number;
};

export function windowStats(points: Point[]): WindowStats | undefined {
  if (points.length === 0) return undefined;
  let high = points[0];
  let low = points[0];
  let sum = 0;
  for (const p of points) {
    if (p.value > high.value) high = p;
    if (p.value < low.value) low = p;
    sum += p.value;
  }
  const moves: Extreme[] = [];
  for (let i = 1; i < points.length; i++) {
    moves.push({ value: points[i].value - points[i - 1].value, date: points[i].date });
  }
  let largestMove: Extreme | undefined;
  for (const m of moves) {
    if (!largestMove || Math.abs(m.value) > Math.abs(largestMove.value)) largestMove = m;
  }
  const abs = moves.map((m) => Math.abs(m.value)).sort((a, b) => a - b);
  const typicalMove =
    abs.length === 0
      ? undefined
      : abs.length % 2
        ? abs[(abs.length - 1) / 2]
        : (abs[abs.length / 2 - 1] + abs[abs.length / 2]) / 2;

  return {
    high: { value: high.value, date: high.date },
    low: { value: low.value, date: low.date },
    mean: sum / points.length,
    first: points[0],
    last: points[points.length - 1],
    largestMove,
    typicalMove,
  };
}

export function pctChange(from: number, to: number): number {
  return ((to - from) / from) * 100;
}

/**
 * Year-on-year % change for a regular series (e.g. quarterly levels → annual
 * growth). `lag` is the number of periods in a year.
 */
export function yoy(points: Point[], lag: number): Point[] {
  const out: Point[] = [];
  for (let i = lag; i < points.length; i++) {
    out.push({ date: points[i].date, value: pctChange(points[i - lag].value, points[i].value) });
  }
  return out;
}

/** Period-on-period % change. */
export function periodChange(points: Point[]): Point[] {
  return yoy(points, 1);
}
