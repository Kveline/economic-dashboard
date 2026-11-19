import { fmtMonth } from "./format";
import type { Point } from "./series";

export type HeatCellData = { value: number; color: string; label: string };
export type HeatRowData = { label: string; cells: (HeatCellData | null)[] };

/**
 * Average a series into a year × month grid for the last `years` years
 * (newest year first). Quarterly points dated before `quarterlyBefore` fill
 * all three months of their quarter.
 */
export function monthlyGrid(
  points: Point[],
  opts: { years: number; end: string; quarterlyBefore?: string; color: (v: number) => string },
): HeatRowData[] {
  const sums = new Map<string, { sum: number; n: number }>();
  const add = (ym: string, v: number) => {
    const cur = sums.get(ym) ?? { sum: 0, n: 0 };
    cur.sum += v;
    cur.n += 1;
    sums.set(ym, cur);
  };
  for (const p of points) {
    const ym = p.date.slice(0, 7);
    if (opts.quarterlyBefore && p.date < opts.quarterlyBefore) {
      const [y, m] = ym.split("-").map(Number);
      for (let k = 0; k < 3; k++) add(`${y}-${String(m - k).padStart(2, "0")}`, p.value);
    } else {
      add(ym, p.value);
    }
  }

  const endYear = Number(opts.end.slice(0, 4));
  const rows: HeatRowData[] = [];
  for (let y = endYear; y > endYear - opts.years; y--) {
    const cells = Array.from({ length: 12 }, (_, i) => {
      const ym = `${y}-${String(i + 1).padStart(2, "0")}`;
      const s = sums.get(ym);
      if (!s) return null;
      const value = s.sum / s.n;
      return { value, color: opts.color(value), label: fmtMonth(`${ym}-01`) };
    });
    if (cells.some(Boolean)) rows.push({ label: String(y), cells });
  }
  return rows;
}

/** Mix a theme colour into the background by `pct` (0–100). Works in both themes. */
export function tint(token: string, pct: number): string {
  const p = Math.round(Math.max(0, Math.min(100, pct)));
  return `color-mix(in srgb, var(--color-${token}) ${p}%, var(--color-inset))`;
}
