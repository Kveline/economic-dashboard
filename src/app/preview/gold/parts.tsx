import type { ReactNode } from "react";
import { formatSigned } from "@/lib/format";

/*
 * Building blocks for the gold preview: white cards with an icon disc and a
 * title, change chips and 16px line glyphs. No "use client", so both the
 * server page and the client pieces can use them.
 */

/**
 * White card: 24px radius, a layered shadow (tight + wide, with a hairline and
 * a top-edge highlight; see --cs on the page) that deepens on hover. Cards
 * aren't links, so they don't move; `lift={false}` keeps the shadow still too.
 */
export function Panel({ children, className = "", labelledBy, lift = true }: { children: ReactNode; className?: string; labelledBy?: string; lift?: boolean }) {
  return (
    <section
      aria-labelledby={labelledBy}
      className={`min-w-0 rounded-[24px] bg-card p-5 shadow-(--cs) transition-shadow duration-300 ease-out sm:p-6 ${lift ? "hover:shadow-(--cs-hover)" : ""} ${className}`}
    >
      {children}
    </section>
  );
}

/** Card header: glyph in a round grey disc, then the title; optional pill on the right. */
export function PanelHead({ id, icon, title, aside, invert = false }: { id?: string; icon: GlyphName; title: ReactNode; aside?: ReactNode; invert?: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3">
      <div className="flex min-w-0 items-center gap-3">
        <span
          className={`grid size-10 shrink-0 place-items-center rounded-full sm:size-11 ${
            invert ? "bg-linear-to-b from-white to-[#bcd4ff] text-[#1e293b] shadow-[0_0_0_4px_rgb(255_255_255/0.06)]" : "bg-linear-to-b from-inset to-chip/70 text-ink shadow-[inset_0_1px_0_rgb(255_255_255/0.6),inset_0_0_0_1px_color-mix(in_srgb,var(--hl)_14%,transparent)] in-data-[theme=dark]:shadow-[inset_0_1px_0_rgb(255_255_255/0.06),inset_0_0_0_1px_color-mix(in_srgb,var(--hl)_18%,transparent)]"
          }`}
        >
          <Glyph name={icon} />
        </span>
        <h2 id={id} className="min-w-0 text-[18px] leading-tight font-medium tracking-[-0.015em] sm:text-[19px]">
          {title}
        </h2>
      </div>
      {aside}
    </div>
  );
}

/** Small grey pill for a card's right side (a label, not a control). */
export function Pill({ children, icon }: { children: ReactNode; icon?: GlyphName }) {
  return (
    <span className="inline-flex shrink-0 items-center gap-1.5 rounded-full bg-inset px-3 py-1.5 text-sm text-muted shadow-[inset_0_0_0_1px_rgb(15_23_42/0.04)] in-data-[theme=dark]:shadow-[inset_0_0_0_1px_rgb(255_255_255/0.06)]">
      {icon && <Glyph name={icon} className="size-4" />}
      {children}
    </span>
  );
}

/**
 * Change chip, after the reference: a round disc with a trend arrow, the
 * signed % in colour and a muted "vs …" label. Up is green and down is red
 * (the page's --up / --down), each on a soft tint of its own colour.
 */
export function Chip({ value, label, digits = 1 }: { value: number | undefined; label: string; digits?: number }) {
  if (value === undefined) return null;
  const flat = Number(value.toFixed(digits)) === 0;
  const up = value > 0 && !flat;
  const tone = flat ? "bg-inset" : up ? "bg-(--up)/12 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--up)_18%,transparent)]" : "bg-(--down)/12 shadow-[inset_0_0_0_1px_color-mix(in_srgb,var(--down)_18%,transparent)]";
  return (
    <span className={`inline-flex max-w-full flex-wrap items-center gap-x-1.5 gap-y-0.5 rounded-full py-1 pr-3 pl-1 text-[13px] ${tone}`}>
      <span className={`grid size-5 shrink-0 place-items-center rounded-full ${flat ? "bg-faint text-on-primary" : up ? "bg-(--up) text-on-tile shadow-[0_2px_6px_-1px_var(--up)]" : "bg-(--down) text-on-tile shadow-[0_2px_6px_-1px_var(--down)]"}`} aria-hidden="true">
        <svg viewBox="0 0 16 16" className="size-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
          {flat ? <path d="M3 8h10" /> : up ? <path d="M2.5 11.5l4-4 2.5 2.5 4.5-5M10 5h3.5v3.5" /> : <path d="M2.5 4.5l4 4 2.5-2.5 4.5 5M10 11h3.5V7.5" />}
        </svg>
      </span>
      <span className={`font-semibold tabular-nums ${flat ? "text-ink" : up ? "text-(--up-ink)" : "text-(--down-ink)"}`}>{flat ? `±0.${"0".repeat(digits)}%` : formatSigned(value, "%", digits)}</span>
      <span className="text-muted">{label}</span>
    </span>
  );
}

export type GlyphName =
  | "bar"
  | "coin"
  | "calendar"
  | "history"
  | "split"
  | "growth"
  | "chart"
  | "target"
  | "range"
  | "average"
  | "peak"
  | "pulse"
  | "line"
  | "gram"
  | "ounce"
  | "kilo"
  | "usd";

const glyphs: Record<GlyphName, ReactNode> = {
  bar: <path d="M2.5 12.5 4.3 7h7.4l1.8 5.5zM5.5 7l.8-2.5h3.4l.8 2.5" />,
  coin: (
    <>
      <circle cx="8" cy="8" r="5.75" />
      <path d="M9.7 6.1c-.3-.5-.9-.8-1.7-.8-.9 0-1.6.5-1.6 1.2 0 1.7 3.3.8 3.3 2.6 0 .7-.7 1.2-1.7 1.2-.7 0-1.4-.3-1.7-.8M8 4.3v7.4" />
    </>
  ),
  calendar: <path d="M3 4.5h10v8.5H3zM3 7.5h10M6 3v3M10 3v3" />,
  history: <path d="M3.5 8a4.5 4.5 0 1 0 1.3-3.2M3.5 3v2.2h2.2M8 5.5V8l1.8 1.2" />,
  split: <path d="M3 4.5h10M3 8h6.5M3 11.5h4M11.5 9.5v4M9.5 11.5h4" />,
  growth: <path d="M2.5 13.5h11M4 11l3-3.5 2 2 3.5-4.5M10 5h2.5v2.5" />,
  chart: <path d="M3 13V9M6.3 13V6M9.7 13V8M13 13V3.5" />,
  target: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="2.5" />
    </>
  ),
  range: <path d="M2.5 8h11M4.5 5.5v5M11.5 5.5v5M8 6.5v3" />,
  average: <path d="M2.5 8h11M2.5 11.5c2-3 3.5-6 5.5-6s3.5 3 5.5 6" />,
  peak: <path d="M2 13l4-6 2.5 3L11 5l3 8M11 2.5v1.5" />,
  pulse: <path d="M2 8.5h2.5l1.5-4 2.5 7 1.5-3h4" />,
  line: <path d="M2.5 12l3-4 2.5 2 5-6.5M2.5 14h11" />,
  gram: <path d="M4 11.5 5.5 7h5l1.5 4.5z" />,
  ounce: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <circle cx="8" cy="8" r="3" />
    </>
  ),
  kilo: <path d="M2 13.5 3.2 10.5h4.6L9 13.5zM7 13.5l1.2-3h4.6l1.2 3zM4.5 10.5l1.2-3h4.6l1.2 3z" />,
  usd: (
    <>
      <circle cx="8" cy="8" r="5.5" />
      <path d="M9.6 6.2c-.3-.5-.9-.8-1.6-.8-.9 0-1.6.5-1.6 1.2 0 1.7 3.3.8 3.3 2.6 0 .7-.7 1.2-1.7 1.2-.7 0-1.4-.3-1.7-.8M8 4.6v6.8" />
    </>
  ),
};

/** 16px line icon in the current text colour, 1.6px stroke. */
export function Glyph({ name, className = "size-[18px]" }: { name: GlyphName; className?: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      {glyphs[name]}
    </svg>
  );
}
