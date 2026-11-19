/*
 * Plain fetch helpers. Caching is handled by the "use cache" functions that
 * call these (see indicators.ts and the `sources` profile in next.config.ts).
 */

export async function fetchText(url: string, init?: RequestInit): Promise<string> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.text();
}

export async function fetchJson<T>(url: string, init?: RequestInit): Promise<T> {
  const res = await fetch(url, init);
  if (!res.ok) throw new Error(`${url} → HTTP ${res.status}`);
  return res.json() as Promise<T>;
}
