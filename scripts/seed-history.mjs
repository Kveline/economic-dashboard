#!/usr/bin/env node
/**
 * Builds the static history files the app relies on for long-range charts.
 * These sources either change rarely (RBA historical workbook) or are not
 * kept current (freegoldapi), so we snapshot them into the repo instead of
 * fetching at request time.
 *
 *   npm run seed            # writes src/data/history/*.json
 *
 * Optional: set METALPRICE_API_KEY in .env.local to fill the gap between the
 * end of the freegoldapi dataset and today.
 */
import { writeFile, mkdir, readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import * as XLSX from "xlsx";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const outDir = path.join(root, "src/data/history");

async function loadEnvLocal() {
  try {
    const text = await readFile(path.join(root, ".env.local"), "utf8");
    for (const line of text.split("\n")) {
      const m = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*)\s*$/);
      if (m && !process.env[m[1]]) process.env[m[1]] = m[2].replace(/^["']|["']$/g, "");
    }
  } catch {
    // no .env.local, fine
  }
}

const iso = (d) => d.toISOString().slice(0, 10);

/** RBA F11 historical workbook (monthly, pre-2023) → [[date, AUDUSD]] */
async function seedAudUsd() {
  const res = await fetch("https://www.rba.gov.au/statistics/tables/xls-hist/f11hist.xls");
  if (!res.ok) throw new Error(`RBA f11hist.xls: HTTP ${res.status}`);
  const wb = XLSX.read(new Uint8Array(await res.arrayBuffer()), { type: "array" });
  const rows = XLSX.utils.sheet_to_json(wb.Sheets["Data"], { header: 1, raw: true });
  const header = rows.findIndex((r) => r[0] === "Series ID");
  const col = rows[header].indexOf("FXRUSD");
  const points = [];
  for (const r of rows.slice(header + 1)) {
    if (typeof r[0] !== "number" || typeof r[col] !== "number") continue;
    const date = XLSX.SSF.parse_date_code(r[0]);
    const d = new Date(Date.UTC(date.y, date.m - 1, date.d));
    // The live CSV (f11.1) starts in 2023; keep only what it doesn't cover.
    if (d < new Date("2023-01-01")) points.push([iso(d), r[col]]);
  }
  return points;
}

/** freegoldapi.com (USD/oz) from 2000, plus optional metalpriceapi gap fill. */
async function seedGoldUsd() {
  const res = await fetch("https://freegoldapi.com/data/latest.json");
  if (!res.ok) throw new Error(`freegoldapi: HTTP ${res.status}`);
  const data = await res.json();
  const points = data
    .filter((p) => p.date >= "2000-01-01" && Number.isFinite(p.price))
    .map((p) => [p.date, Math.round(p.price * 100) / 100]);

  const key = process.env.METALPRICE_API_KEY;
  if (!key) {
    console.log(`  gold: no METALPRICE_API_KEY, history ends ${points.at(-1)[0]}`);
    return points;
  }

  // Fill from the day after the last point up to yesterday, weekly samples
  // via the historical endpoint (works on the free plan, ~1 call per week).
  const last = new Date(points.at(-1)[0]);
  const today = new Date();
  const filled = [];
  for (let d = new Date(last.getTime() + 7 * 864e5); d < today; d = new Date(d.getTime() + 7 * 864e5)) {
    const day = iso(d);
    const r = await fetch(
      `https://api.metalpriceapi.com/v1/${day}?api_key=${key}&base=USD&currencies=XAU`,
    );
    const j = await r.json();
    const usdPerOz = j?.rates?.USDXAU ?? (j?.rates?.XAU ? 1 / j.rates.XAU : undefined);
    if (!j.success || !usdPerOz) {
      console.warn(`  gold: metalpriceapi stopped at ${day}:`, j?.error?.info ?? j?.error ?? r.status);
      break;
    }
    filled.push([day, Math.round(usdPerOz * 100) / 100]);
  }
  console.log(`  gold: metalpriceapi filled ${filled.length} weekly points`);
  return points.concat(filled);
}

await loadEnvLocal();
await mkdir(outDir, { recursive: true });

const aud = await seedAudUsd();
await writeFile(path.join(outDir, "audusd.json"), JSON.stringify(aud));
console.log(`audusd.json: ${aud.length} points ${aud[0]?.[0]} → ${aud.at(-1)?.[0]}`);

const gold = await seedGoldUsd();
await writeFile(path.join(outDir, "gold-usd.json"), JSON.stringify(gold));
console.log(`gold-usd.json: ${gold.length} points ${gold[0]?.[0]} → ${gold.at(-1)?.[0]}`);
