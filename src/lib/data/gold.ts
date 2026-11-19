import { cacheLife } from "next/cache";
import goldUsdHistory from "@/data/history/gold-usd.json";
import { sortPoints, type Point } from "../series";
import { fetchJson } from "./fetch";

export const GRAMS_PER_TROY_OUNCE = 31.1034768;

type GoldApiPrice = { price: number; updatedAt: string };

/** Live spot gold in USD per troy ounce, from gold-api.com (no key needed). */
async function fetchLiveGoldUsd(): Promise<Point | undefined> {
  "use cache";
  // Spot moves intraday, so refresh hourly rather than with the sources profile.
  cacheLife("hours");
  try {
    const j = await fetchJson<GoldApiPrice>("https://api.gold-api.com/price/XAU");
    if (!Number.isFinite(j.price)) return undefined;
    return { date: j.updatedAt.slice(0, 10), value: j.price };
  } catch {
    return undefined;
  }
}

/**
 * Gold in USD/oz: the seeded history (see scripts/seed-history.mjs) plus
 * today's live price.
 */
export async function fetchGoldUsd(): Promise<Point[]> {
  const history: Point[] = (goldUsdHistory as [string, number][]).map(([date, value]) => ({ date, value }));
  const live = await fetchLiveGoldUsd();
  if (live) {
    const filtered = history.filter((p) => p.date !== live.date);
    filtered.push(live);
    return sortPoints(filtered);
  }
  return history;
}
