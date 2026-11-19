import { cacheLife } from "next/cache";
import { fetchText } from "./fetch";

/**
 * RBA Monetary Policy Board meetings. Decisions are announced at 2:30pm on the
 * second day of each meeting; these are those announcement dates.
 * Source: rba.gov.au/schedules-events/board-meeting-schedules.html
 * Update once a year when the RBA publishes the next year's schedule.
 */
export const RBA_DECISION_DATES = [
  "2026-02-03",
  "2026-03-31",
  "2026-05-05",
  "2026-06-16",
  "2026-08-11",
  "2026-09-29",
  "2026-11-03",
  "2026-12-08",
  "2027-02-09",
  "2027-03-23",
  "2027-05-04",
  "2027-06-22",
  "2027-08-10",
  "2027-09-28",
  "2027-11-02",
  "2027-12-14",
];

export function upcomingDecisions(today: string, count = 3): string[] {
  return RBA_DECISION_DATES.filter((d) => d >= today).slice(0, count);
}

export type ReleaseKey = "labour-force" | "cpi" | "national-accounts";

const RELEASE_TITLES: Record<ReleaseKey, (title: string) => boolean> = {
  "labour-force": (t) => t === "Labour Force, Australia",
  cpi: (t) => t === "Consumer Price Index, Australia",
  "national-accounts": (t) =>
    t.startsWith("Australian National Accounts: National Income, Expenditure and Product"),
};

/**
 * Next ABS release dates, scraped from the ABS future releases calendar.
 * The calendar only covers the next few weeks, so a key may be missing.
 */
export async function fetchAbsReleaseDates(): Promise<Partial<Record<ReleaseKey, string>>> {
  "use cache";
  cacheLife("sources");
  try {
    const html = await fetchText("https://www.abs.gov.au/release-calendar/future-releases");
    const out: Partial<Record<ReleaseKey, string>> = {};
    const re = /<time datetime="([^"]+)"[^>]*>[\s\S]*?event-name">\s*([^<]+?)\s*<\/h3>/g;
    for (const m of html.matchAll(re)) {
      // Releases are 11:30am Canberra time; convert the UTC stamp to a local date.
      const local = new Date(new Date(m[1]).getTime() + 11 * 3_600_000).toISOString().slice(0, 10);
      for (const [key, matches] of Object.entries(RELEASE_TITLES) as [ReleaseKey, (t: string) => boolean][]) {
        if (matches(m[2]) && !out[key]) out[key] = local;
      }
    }
    return out;
  } catch {
    return {};
  }
}
