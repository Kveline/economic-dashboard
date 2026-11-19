import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import type { IndicatorKey, Tone } from "@/lib/data/indicators";
import { formatUnsigned } from "@/lib/format";
import type { BadgeTone, StatusIcon } from "@/lib/status";
import { InfoTip } from "./InfoTip";
import { AnimatedNumber } from "./motion";

/*
 * Building blocks for the light main page. Every indicator card has the same
 * anatomy so the grid scans in one pass:
 *   icon · · · · · · · · ·  open
 *   Group
 *   Title (?)
 *   BIG VALUE
 *   change pill  vs prev …
 *   chart / visual
 *   footnote
 */

export function HomeCard({
  title,
  group,
  href,
  icon,
  explainer,
  delay = 0,
  className = "",
  children,
}: {
  title: string;
  group: string;
  href: string;
  icon: IndicatorKey;
  explainer: string;
  delay?: number;
  className?: string;
  children: ReactNode;
}) {
  return (
    <article
      className={`group animate-rise relative flex min-w-0 flex-col rounded-[20px] bg-card p-6 shadow-card transition-[translate,box-shadow] duration-500 ease-out hover:-translate-y-1 hover:shadow-pop focus-within:z-20 hover:z-20 ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      <div className="flex items-center gap-3.5">
        <Tile indicator={icon} round />
        <div className="min-w-0 flex-1">
          <h3 className="flex items-center gap-2 text-[15px] font-medium">
            <Link href={href} className="truncate hover:underline hover:decoration-line hover:underline-offset-4">
              {title}
            </Link>
            <InfoTip label={title}>{explainer}</InfoTip>
          </h3>
          <p className="mt-0.5 text-xs text-faint">{group}</p>
        </div>
        <Link
          href={href}
          aria-label={`Open ${title} details`}
          className="flex h-10 shrink-0 items-center gap-1.5 rounded-full bg-inset px-3.5 text-xs font-medium text-primary transition duration-300 group-hover:bg-primary-solid group-hover:text-on-primary-solid"
        >
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M2.5 11.5l4-4 2.5 2.5 4.5-5M10 5h3.5v3.5" />
          </svg>
          <span className="hidden sm:inline">Details</span>
        </Link>
      </div>
      {children}
    </article>
  );
}

const CURRENCY_CODE: Record<string, string> = { "US$": "USD", "A$": "AUD" };

/** Big dark number with a light grey unit after it, e.g. "0.6900 USD", "4.3 %". */
export function BigValue({
  value,
  digits,
  prefix,
  suffix,
  size = "lg",
  accent = false,
}: {
  value: number;
  digits: number;
  prefix?: string;
  suffix?: string;
  size?: "lg" | "xl";
  /** Unit in the accent colour (detail pages) instead of grey. */
  accent?: boolean;
}) {
  const unit = `text-[0.62em] font-normal tracking-normal ${accent ? "text-primary" : "text-faint"}`;
  return (
    <p className={`mt-3 font-medium tracking-tight tabular-nums ${size === "xl" ? "text-[52px] leading-none" : "text-[40px] leading-none"}`}>
      <AnimatedNumber value={value} digits={digits} />
      {prefix && <span className={`ml-2 ${unit}`}>{CURRENCY_CODE[prefix] ?? prefix}</span>}
      {suffix && <span className={`ml-1 ${unit}`}>{suffix}</span>}
    </p>
  );
}

const toneText: Record<Tone, string> = { good: "text-good", bad: "text-bad", neutral: "text-muted" };

/** Change line: "+0.3pp vs prev month", value coloured by meaning. */
export function ChangeLine({
  value,
  unit,
  tone,
  label,
}: {
  value: number | undefined;
  unit: "pp" | "%";
  tone: Tone;
  label: string;
}) {
  if (value === undefined) return null;
  const digits = unit === "%" ? 2 : 1;
  const flat = Number(value.toFixed(digits)) === 0;
  const sign = flat ? "±" : value > 0 ? "+" : "−";
  return (
    <p className="mt-2 flex flex-wrap items-center gap-1.5 text-[13px]">
      <span className={`inline-flex items-center gap-0.5 font-semibold tabular-nums ${toneText[tone]}`}>
        {!flat && (
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            {value > 0 ? <path d="M8 13V3M4 7l4-4 4 4" /> : <path d="M8 3v10M4 9l4 4 4-4" />}
          </svg>
        )}
        {sign}
        {formatUnsigned(value, unit, digits)}
      </span>
      <span className="text-faint">{label}</span>
    </p>
  );
}

/**
 * Quiet progress ring: white face, thin grey track, slim blue arc with a dot
 * at its end. `progress` is 0–1 and the arc draws in on load.
 */
export function Ring({ progress, children, size = 120 }: { progress: number; children: ReactNode; size?: number }) {
  const p = Math.max(0, Math.min(1, progress));
  const to = 100 - p * 100;
  const angle = p * 2 * Math.PI;
  return (
    <div className="relative grid shrink-0 place-items-center rounded-full bg-card shadow-card" style={{ width: size, height: size }}>
      <svg viewBox="0 0 100 100" className="absolute inset-0 -rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r="42" fill="none" stroke="var(--color-soft)" strokeOpacity={0.55} strokeWidth="3.5" />
        <circle
          cx="50"
          cy="50"
          r="42"
          fill="none"
          stroke="var(--color-primary-mark)"
          strokeWidth="3.5"
          strokeLinecap="round"
          pathLength={100}
          strokeDasharray="100"
          strokeDashoffset={to}
          style={{ "--ring-to": to, animation: "ring-fill 1.4s var(--ease-out-soft) 300ms both" } as CSSProperties}
        />
        {p > 0 && (
          <circle
            cx={50 + 42 * Math.cos(angle)}
            cy={50 + 42 * Math.sin(angle)}
            r="4"
            fill="var(--color-primary-mark)"
            stroke="var(--color-card)"
            strokeWidth="2"
            className="animate-fade"
            style={{ animationDelay: "1500ms" }}
          />
        )}
      </svg>
      <div className="relative text-center">{children}</div>
    </div>
  );
}

const iconTone: Record<BadgeTone, string> = {
  good: "text-good",
  bad: "text-bad",
  warn: "text-warn",
  neutral: "text-faint",
  accent: "text-primary",
};

const statusGlyph: Record<StatusIcon, ReactNode> = {
  up: <path d="M8 12.5v-9M4 7l4-4 4 4" />,
  down: <path d="M8 3.5v9M4 9l4 4 4-4" />,
  within: <path d="M3.5 8.5l3 3 6-7" />,
  near: <path d="M3 6.5h10M3 10h10" />,
  rising: <path d="M2.5 11.5l4-4 2.5 2.5 4.5-5M10 5h3.5v3.5" />,
  falling: <path d="M2.5 4.5l4 4L9 6l4.5 5M10 11h3.5V7.5" />,
  hold: <path d="M6 4v8M10 4v8" />,
};

/** Quiet status line: a small coloured icon, then plain grey text. */
export function StatusLine({ tone, icon, children }: { tone: BadgeTone; icon: StatusIcon; children: ReactNode }) {
  return (
    <span className="inline-flex items-center gap-1.5 text-[13px] text-muted">
      <svg
        viewBox="0 0 16 16"
        className={`size-3.5 shrink-0 ${iconTone[tone]}`}
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
        aria-hidden="true"
      >
        {statusGlyph[icon]}
      </svg>
      {children}
    </span>
  );
}

/* ---- indicator tiles ---- */

const TILES: Record<IndicatorKey, { bg: string; fg?: string; icon: keyof typeof Icons }> = {
  audusd: { bg: "bg-tile-blue", icon: "exchange" },
  gold: { bg: "bg-tile-amber", fg: "text-on-tile", icon: "gold" },
  "cash-rate": { bg: "bg-tile-indigo", icon: "bank" },
  cpi: { bg: "bg-tile-rose", fg: "text-on-tile", icon: "tag" },
  unemployment: { bg: "bg-tile-teal", fg: "text-on-tile", icon: "people" },
  gdp: { bg: "bg-tile-violet", icon: "growth" },
};

/** Coloured rounded tile with a white icon, one colour per indicator. */
export function Tile({ indicator, size = "md", round = false }: { indicator: IndicatorKey; size?: "md" | "lg"; round?: boolean }) {
  const t = TILES[indicator];
  return (
    <span
      className={`grid shrink-0 place-items-center shadow-[0_10px_20px_-10px_rgb(15_23_42/0.35)] ${t.bg} ${t.fg ?? "text-on-tile-solid"} ${
        size === "lg" ? "size-14 [&_svg]:size-6" : "size-11"
      } ${round ? "rounded-full ring-4 ring-card" : "rounded-2xl"}`}
    >
      {Icons[t.icon]}
    </span>
  );
}

/* ---- icons (24px grid, 1.6 stroke) ---- */

const iconProps = {
  viewBox: "0 0 24 24",
  className: "size-[18px]",
  fill: "none",
  stroke: "currentColor",
  strokeWidth: 1.6,
  strokeLinecap: "round" as const,
  strokeLinejoin: "round" as const,
  "aria-hidden": true,
};

export const Icons = {
  exchange: (
    <svg {...iconProps}>
      <path d="M4 8h14l-3-3M20 16H6l3 3" />
    </svg>
  ),
  gold: (
    <svg {...iconProps}>
      <path d="M3 18l3-6h6l3 6zM9 12l3-6h6l3 6h-6" />
    </svg>
  ),
  bank: (
    <svg {...iconProps}>
      <path d="M3 9l9-5 9 5M5 9v8M10 9v8M14 9v8M19 9v8M3 20h18" />
    </svg>
  ),
  tag: (
    <svg {...iconProps}>
      <path d="M3 12V4h8l10 10-8 8z" />
      <circle cx="7.5" cy="8.5" r="1.2" />
    </svg>
  ),
  people: (
    <svg {...iconProps}>
      <circle cx="9" cy="8" r="3" />
      <path d="M3 20c0-3.3 2.7-6 6-6s6 2.7 6 6M16 5a3 3 0 010 6M18 14c1.8.7 3 2.6 3 6" />
    </svg>
  ),
  growth: (
    <svg {...iconProps}>
      <path d="M4 20V10M10 20V4M16 20v-7M22 20H2" />
    </svg>
  ),
};
