import { sortPoints, type Point } from "../series";
import { fetchJson } from "./fetch";

type SdmxValue = { id: string; name: string };
type SdmxJson = {
  data: {
    structures: { dimensions: { observation: { id: string; values: SdmxValue[] }[] } }[];
    dataSets: { observations: Record<string, [number | string | null, ...unknown[]]> }[];
  };
};

export type AbsObservation = {
  /** Dimension id → value code, e.g. { MEASURE: "M1", DATA_ITEM: "GPM" } */
  dims: Record<string, string>;
  date: string;
  value: number;
};

/**
 * ABS TIME_PERIOD → ISO date. Months map to the 1st; quarters map to the 1st
 * of the quarter's last month (so "2026-Q2" → 2026-06-01, shown as "Jun qtr").
 */
export function periodToDate(period: string): string {
  const q = period.match(/^(\d{4})-Q([1-4])$/);
  if (q) return `${q[1]}-${String(Number(q[2]) * 3).padStart(2, "0")}-01`;
  const m = period.match(/^(\d{4})-(\d{2})$/);
  if (m) return `${m[1]}-${m[2]}-01`;
  return period;
}

/**
 * Fetch an ABS Data API query (SDMX-JSON) and flatten it to observations.
 * `query` is the part after /rest/data/, e.g. "ABS,LF,1.0.0/M13.3.1599.20.AUS.M".
 */
export async function fetchAbs(query: string, startPeriod: string): Promise<AbsObservation[]> {
  const url = `https://data.api.abs.gov.au/rest/data/${query}?startPeriod=${startPeriod}&dimensionAtObservation=AllDimensions`;
  const json = await fetchJson<SdmxJson>(url, {
    headers: { Accept: "application/vnd.sdmx.data+json" },
  });
  const dims = json.data.structures[0].dimensions.observation;
  const out: AbsObservation[] = [];
  for (const [key, obs] of Object.entries(json.data.dataSets[0].observations)) {
    const value = Number(obs[0]);
    if (obs[0] === null || !Number.isFinite(value)) continue;
    const idx = key.split(":").map(Number);
    const rec: Record<string, string> = {};
    let date = "";
    idx.forEach((v, i) => {
      const dim = dims[i];
      if (dim.id === "TIME_PERIOD") date = periodToDate(dim.values[v].id);
      else rec[dim.id] = dim.values[v].id;
    });
    out.push({ dims: rec, date, value });
  }
  return out;
}

/** Select one series from flattened observations by dimension filter. */
export function pick(obs: AbsObservation[], filter: Record<string, string>): Point[] {
  return sortPoints(
    obs
      .filter((o) => Object.entries(filter).every(([k, v]) => o.dims[k] === v))
      .map((o) => ({ date: o.date, value: o.value })),
  );
}
