"use client";

import { useId, useState } from "react";

/* --------------------------------------------------------- Converter ---- */

/** "Travel money": type an amount in A$ and see it in each currency. */
export function Converter({
  rates,
  date,
}: {
  rates: { code: string; name: string; symbol: string; rate: number }[];
  date: string;
}) {
  const [amount, setAmount] = useState(1000);
  const id = useId();
  const presets = [100, 500, 1000, 5000];
  const fmt = (v: number, code: string) =>
    v.toLocaleString("en-AU", { maximumFractionDigits: code === "JPY" ? 0 : 2, minimumFractionDigits: code === "JPY" ? 0 : 2 });

  return (
    <div className="flex flex-col">
      {/* Amount first: it drives every number below */}
      <div className="rounded-[16px] bg-inset p-4 ring-1 ring-transparent focus-within:ring-2 focus-within:ring-primary sm:p-5">
        <label htmlFor={id} className="text-xs text-muted">
          You have
        </label>
        <div className="mt-2 flex items-baseline gap-2">
          <span className="text-xl font-medium text-faint">A$</span>
          <input
            id={id}
            type="number"
            inputMode="decimal"
            min={0}
            value={Number.isFinite(amount) ? amount : ""}
            onChange={(e) => setAmount(Math.max(0, Number(e.target.value)))}
            className="w-full min-w-0 bg-transparent text-[32px] leading-none font-medium tracking-tight tabular-nums outline-none"
          />
        </div>
        <div className="mt-4 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setAmount(p)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-medium tabular-nums transition-colors ${
                amount === p ? "bg-card text-ink shadow-card" : "text-muted hover:text-ink"
              }`}
            >
              A${p.toLocaleString("en-AU")}
            </button>
          ))}
        </div>
      </div>

      {/* Every currency as one list: same row, same place for every number */}
      <p className="mt-6 mb-1 text-xs text-muted">That buys</p>
      <ul className="divide-y divide-line">
        {rates.map((r) => (
          <li key={r.code} className="flex items-center justify-between gap-3 py-3.5">
            <span className="flex min-w-0 items-center gap-3">
              <span className="grid h-7 w-11 shrink-0 place-items-center rounded-full bg-inset text-[11px] font-semibold text-primary">{r.code}</span>
              <span className="truncate text-sm font-medium text-ink">{r.name}</span>
            </span>
            <span className="shrink-0 text-[17px] font-medium tracking-tight text-ink tabular-nums">
              <span className="mr-1 text-[13px] font-normal text-faint">{r.symbol}</span>
              {fmt(amount * r.rate, r.code)}
            </span>
          </li>
        ))}
      </ul>

      <p className="mt-3 text-xs text-faint">At the RBA&apos;s rates on {date}. Banks and money changers add a margin.</p>
    </div>
  );
}

/* ---------------------------------------------------------- Mortgage ---- */

function monthly(principal: number, annualRatePct: number, years = 30) {
  const r = annualRatePct / 100 / 12;
  const n = years * 12;
  return r === 0 ? principal / n : (principal * r) / (1 - (1 + r) ** -n);
}

export type MortgageBaseline = {
  key: string;
  /** Switch label, e.g. "A year ago". */
  label: string;
  rate: number;
  /** When that rate applied, already formatted. */
  when: string;
};

/**
 * What cash rate moves mean for a typical variable mortgage, against a
 * baseline the reader picks (a year ago by default). Assumes banks pass rate
 * changes on in full, a 30-year loan, and a fixed margin over the cash rate:
 * an illustration, not a quote.
 */
const LOAN_MIN = 100_000;
const LOAN_MAX = 1_500_000;

/** Stepped line (rates hold until the next decision) in a 0–100 × 0–40 box, plus its filled area. */
function stepPaths(values: number[]) {
  if (values.length < 2) return { line: "", area: "" };
  const lo = Math.min(...values);
  const hi = Math.max(...values);
  const span = hi - lo || 1;
  const w = 100 / values.length;
  const y = (v: number) => 36 - ((v - lo) / span) * 30;
  let line = `M0,${y(values[0])}`;
  values.forEach((v, i) => {
    if (i > 0) line += ` V${y(v)}`;
    line += ` H${(i + 1) * w}`;
  });
  return { line, area: `${line} V40 H0 Z` };
}

export function Mortgage({
  rate,
  baselines,
  history = [],
  margin = 2.6,
}: {
  rate: number;
  baselines: MortgageBaseline[];
  /** Recent cash rates, oldest first, for the repayment trend line. */
  history?: number[];
  margin?: number;
}) {
  const [loan, setLoan] = useState(600_000);
  const id = useId();
  // Compared with the first baseline (a year ago).
  const base = baselines[0];
  const now = monthly(loan, rate + margin);
  const then = base ? monthly(loan, base.rate + margin) : now;
  const diff = Math.round(now) - Math.round(then);
  const up = diff >= 0;
  const sign = diff > 0 ? "+" : diff < 0 ? "−" : "";
  const money = (v: number) => `A$${Math.round(Math.abs(v)).toLocaleString("en-AU")}`;
  const pct = ((loan - LOAN_MIN) / (LOAN_MAX - LOAN_MIN)) * 100;
  const change = then ? (diff / Math.round(then)) * 100 : 0;
  const trend = stepPaths(history.map((r) => monthly(loan, r + margin)));
  const presets = [300_000, 500_000, 750_000, 1_000_000];
  const short = (v: number) => (v >= 1_000_000 ? `A$${v / 1_000_000}m` : `A$${v / 1000}k`);

  return (
    <div className="flex flex-col">
      {/* Loan size first: it drives every number below */}
      <div>
        <div className="flex items-baseline justify-between gap-3">
          <label htmlFor={id} className="text-sm text-muted">
            Loan size
          </label>
          <span className="text-lg font-semibold tracking-tight tabular-nums">{money(loan)}</span>
        </div>
        <div className="relative mt-3 h-5">
          <input
            id={id}
            type="range"
            min={LOAN_MIN}
            max={LOAN_MAX}
            step={10_000}
            value={loan}
            onChange={(e) => setLoan(Number(e.target.value))}
            className="peer absolute inset-0 z-10 w-full cursor-pointer opacity-0"
          />
          <span className="absolute inset-x-0 top-1/2 h-1.5 -translate-y-1/2 rounded-full bg-soft/45" aria-hidden="true" />
          <span className="absolute top-1/2 left-0 h-1.5 -translate-y-1/2 rounded-full bg-primary-mark" style={{ width: `${pct}%` }} aria-hidden="true" />
          <span
            className="absolute top-1/2 size-5 -translate-x-1/2 -translate-y-1/2 rounded-full border-4 border-primary bg-card shadow-card peer-focus-visible:ring-4 peer-focus-visible:ring-primary/45"
            style={{ left: `calc(10px + (100% - 20px) * ${pct / 100})` }}
            aria-hidden="true"
          />
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5">
          {presets.map((p) => (
            <button
              key={p}
              type="button"
              onClick={() => setLoan(p)}
              className={`rounded-full px-3 py-1 text-xs tabular-nums transition ${
                loan === p ? "bg-primary-tint font-medium text-primary" : "bg-inset text-muted hover:bg-chip hover:text-ink"
              }`}
            >
              {short(p)}
            </button>
          ))}
        </div>
      </div>

      {/* Hero: the repayment, its recent trend and the loan rate */}
      <div className="mt-6 border-t border-line pt-6">
        <div className="flex items-end justify-between gap-4">
          <div>
            <p className="text-sm text-muted">Monthly repayment</p>
            <p className="mt-2 flex items-baseline gap-1.5">
              <span className="text-[40px] leading-none font-semibold tracking-tight tabular-nums">{money(now)}</span>
              <span className="text-sm text-faint">/ month</span>
            </p>
            <p className="mt-2 text-xs text-faint tabular-nums">at {(rate + margin).toFixed(2)}% p.a.</p>
          </div>
          {trend.line && (
            <svg viewBox="0 0 100 40" className="mb-1 h-10 w-24 shrink-0 overflow-visible sm:w-32" preserveAspectRatio="none" aria-hidden="true">
              <path d={trend.area} fill="var(--color-primary-mark)" fillOpacity="0.06" />
              <path d={trend.line} fill="none" stroke="var(--color-primary-mark)" strokeWidth="1.5" strokeLinejoin="round" vectorEffect="non-scaling-stroke" />
            </svg>
          )}
        </div>
      </div>

      {/* Compared with the baseline: one quiet row split by hairlines */}
      {base && (
        <div className="mt-6 grid grid-cols-3 divide-x divide-line border-t border-line pt-5">
          <div className="min-w-0 pr-3">
            <p className="text-xs whitespace-nowrap text-muted">{base.label}</p>
            <p className="mt-1.5 text-base font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-lg">{money(then)}</p>
            <p className="mt-0.5 text-xs text-faint tabular-nums">at {(base.rate + margin).toFixed(2)}%</p>
          </div>
          <div className="min-w-0 px-3 sm:px-4">
            <p className="text-xs whitespace-nowrap text-muted">{up ? "Extra a month" : "Less a month"}</p>
            <p className="mt-1.5 text-base font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-lg">
              {sign}
              {money(diff)}
            </p>
            <p className={`mt-0.5 text-xs tabular-nums ${up ? "text-bad" : "text-good"}`}>
              {up ? "↑" : "↓"} {Math.abs(change).toFixed(1)}%
            </p>
          </div>
          <div className="min-w-0 pl-3 sm:pl-4">
            <p className="text-xs whitespace-nowrap text-muted">{up ? "Extra a year" : "Less a year"}</p>
            <p className="mt-1.5 text-base font-semibold tracking-tight whitespace-nowrap tabular-nums sm:text-lg">
              {sign}
              {money(diff * 12)}
            </p>
            <p className="mt-0.5 text-xs whitespace-nowrap text-faint">12 months</p>
          </div>
        </div>
      )}

      <p className="mt-6 text-xs text-faint">
        Estimate for a 30-year variable loan. Cash rate {rate.toFixed(2)}% + {margin.toFixed(2)}% margin.
      </p>
    </div>
  );
}

/* ----------------------------------------------------------- Heatmap ---- */

export type HeatRow = { label: string; cells: ({ value: number; color: string; label: string } | null)[]; aside?: string };

type HeatLegend = { stops: string[]; labels: [string, string] } | { items: { color: string; label: string }[] };

const MONTHS = ["J", "F", "M", "A", "M", "J", "J", "A", "S", "O", "N", "D"];

/** Year × month grid; hovering a cell shows its value underneath. */
export function Heatmap({
  rows,
  format,
  legend,
  asideLabel,
}: {
  rows: HeatRow[];
  format: string;
  legend: HeatLegend;
  /** Header for the optional per-row summary column. */
  asideLabel?: string;
}) {
  const [hover, setHover] = useState<{ label: string; value: number } | null>(null);
  const show = (v: number) => (format === "fx" ? v.toFixed(4) : `${v.toFixed(1)}%`);

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[480px] table-fixed border-separate border-spacing-1" onMouseLeave={() => setHover(null)}>
          <colgroup>
            <col className="w-11" />
            {MONTHS.map((_, i) => (
              <col key={i} />
            ))}
            {asideLabel && <col className="w-16" />}
          </colgroup>
          <thead>
            <tr className="text-[10px] text-faint">
              <th />
              {MONTHS.map((m, i) => (
                <th key={i} className="font-normal">
                  {m}
                </th>
              ))}
              {asideLabel && <th className="pl-2 text-right font-normal">{asideLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, ri) => (
              <tr key={row.label}>
                <th scope="row" className="pr-2 text-right text-[11px] font-normal text-faint">
                  {row.label}
                </th>
                {row.cells.map((c, ci) => (
                  <td key={ci} className="p-0">
                    {c ? (
                      <span
                        tabIndex={0}
                        onMouseEnter={() => setHover(c)}
                        onFocus={() => setHover(c)}
                        aria-label={`${c.label}: ${show(c.value)}`}
                        className="animate-fade block h-6 rounded-md transition-transform outline-none hover:scale-110 hover:ring-2 hover:ring-ink/30 focus-visible:ring-2 focus-visible:ring-primary"
                        style={{ background: c.color, animationDelay: `${ri * 30 + ci * 6}ms` }}
                      />
                    ) : (
                      <span className="block h-6 rounded-md bg-inset/50" />
                    )}
                  </td>
                ))}
                {asideLabel && <td className="pl-2 text-right text-[11px] text-muted tabular-nums">{row.aside}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center justify-between gap-3 text-xs">
        <p className="text-muted" aria-live="polite">
          {hover ? (
            <>
              <span className="text-faint">{hover.label}</span> · <strong className="font-semibold text-ink tabular-nums">{show(hover.value)}</strong>
            </>
          ) : (
            <span className="text-faint">Hover a square to see its value</span>
          )}
        </p>
        {"items" in legend ? (
          <span className="flex flex-wrap items-center gap-x-3 gap-y-1 text-faint">
            {legend.items.map((it) => (
              <span key={it.label} className="flex items-center gap-1.5">
                <span className="size-2.5 rounded-[3px]" style={{ background: it.color }} />
                {it.label}
              </span>
            ))}
          </span>
        ) : (
          <span className="flex items-center gap-2 text-faint">
            {legend.labels[0]}
            <span className="h-2 w-28 rounded-full" style={{ background: `linear-gradient(90deg, ${legend.stops.join(", ")})` }} />
            {legend.labels[1]}
          </span>
        )}
      </div>
    </div>
  );
}
