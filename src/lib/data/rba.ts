import { sortPoints, type Point } from "../series";
import { fetchText } from "./fetch";

/*
 * Note: RBA's CDN rejects browser-like User-Agent strings with a 403 but
 * accepts Node's default fetch, so we deliberately don't set one.
 */

const MONTHS: Record<string, string> = {
  jan: "01", feb: "02", mar: "03", apr: "04", may: "05", jun: "06",
  jul: "07", aug: "08", sep: "09", oct: "10", nov: "11", dec: "12",
};

/** RBA CSVs use "05-Nov-2026" (F11) or "31/10/2026" (F1). */
function parseRbaDate(s: string): string | undefined {
  let m = s.match(/^(\d{1,2})-([A-Za-z]{3})-(\d{4})$/);
  if (m) return `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`;
  m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`;
  return undefined;
}

/**
 * Parse an RBA statistical table CSV. The file has ~10 metadata rows; the
 * "Series ID" row names the columns and data follows it.
 */
export function parseRbaCsv(csv: string): Record<string, Point[]> {
  const lines = csv.replace(/\r/g, "").split("\n");
  const headerIdx = lines.findIndex((l) => l.startsWith("Series ID,"));
  if (headerIdx < 0) throw new Error("RBA CSV: no Series ID row");
  const ids = lines[headerIdx].split(",").slice(1);
  const out: Record<string, Point[]> = Object.fromEntries(ids.map((id) => [id, []]));
  for (const line of lines.slice(headerIdx + 1)) {
    const cells = line.split(",");
    const date = parseRbaDate(cells[0]?.trim() ?? "");
    if (!date) continue;
    ids.forEach((id, i) => {
      const raw = cells[i + 1]?.trim();
      if (!raw) return;
      const value = Number(raw);
      if (Number.isFinite(value)) out[id].push({ date, value });
    });
  }
  for (const id of ids) out[id] = sortPoints(out[id]);
  return out;
}

export async function fetchExchangeRates(): Promise<Record<string, Point[]>> {
  return parseRbaCsv(await fetchText("https://www.rba.gov.au/statistics/tables/csv/f11.1-data.csv"));
}

export async function fetchCashRateTable(): Promise<Point[]> {
  const table = parseRbaCsv(await fetchText("https://www.rba.gov.au/statistics/tables/csv/f1.1-data.csv"));
  return table.FIRMMCRT ?? [];
}

export type RateDecision = {
  /** Effective date (the day after the Board's announcement). */
  date: string;
  /** Change in percentage points. */
  change: number;
  /** New cash rate target, %. */
  rate: number;
};

/**
 * Every cash rate decision since 1990, scraped from the RBA's cash rate page.
 * More current than F1.1 (which is month-end only and can lag a decision).
 */
export async function fetchRateDecisions(): Promise<RateDecision[]> {
  const html = (await fetchText("https://www.rba.gov.au/statistics/cash-rate/")).replace(
    /<!--[\s\S]*?-->/g,
    "",
  );
  const decisions: RateDecision[] = [];
  for (const row of html.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/g)) {
    const cells = [...row[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/g)].map((c) =>
      c[1].replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/\s+/g, " ").trim(),
    );
    const m = cells[0]?.match(/^(\d{1,2}) ([A-Za-z]{3}) (\d{4})$/);
    if (!m) continue;
    const change = Number(cells[1]?.replace("–", "-").replace("−", "-"));
    // Older rows give a range like "17.00 to 17.50"; take the upper bound.
    const rate = Number(cells[2]?.split(/\s+to\s+/).at(-1));
    if (!Number.isFinite(rate)) continue;
    decisions.push({
      date: `${m[3]}-${MONTHS[m[2].toLowerCase()]}-${m[1].padStart(2, "0")}`,
      change: Number.isFinite(change) ? change : 0,
      rate,
    });
  }
  if (decisions.length === 0) throw new Error("RBA cash rate page: no decisions parsed");
  return decisions.sort((a, b) => (a.date < b.date ? -1 : 1));
}
