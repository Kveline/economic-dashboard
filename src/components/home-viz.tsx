import Link from "next/link";
import type { ReactNode } from "react";
import type { Point } from "@/lib/series";

/*
 * Visuals for the main page: smooth curves with a dark callout on the latest
 * point, capsule bars for rate decisions, and list rows that float on a
 * tinted panel. Server-rendered SVG + HTML overlays (dots stay round).
 */

const DAY = 86_400_000;
const t = (d: string) => Date.parse(`${d}T00:00:00Z`);

/** Keep at most `max` points (always the first and last) so curves stay smooth. */
function thin(points: Point[], max: number): Point[] {
  if (points.length <= max) return points;
  const step = (points.length - 1) / (max - 1);
  const out: Point[] = [];
  for (let i = 0; i < max; i++) out.push(points[Math.round(i * step)]);
  return out;
}

/** Catmull-Rom through the points as cubic Béziers (in 0–100 space). */
function smooth(xy: [number, number][]): string {
  if (xy.length < 2) return "";
  let d = `M${xy[0][0].toFixed(2)},${xy[0][1].toFixed(2)}`;
  for (let i = 0; i < xy.length - 1; i++) {
    const p0 = xy[i - 1] ?? xy[i];
    const p1 = xy[i];
    const p2 = xy[i + 1];
    const p3 = xy[i + 2] ?? p2;
    const c1x = p1[0] + (p2[0] - p0[0]) / 6;
    const c1y = p1[1] + (p2[1] - p0[1]) / 6;
    const c2x = p2[0] - (p3[0] - p1[0]) / 6;
    const c2y = p2[1] - (p3[1] - p1[1]) / 6;
    d += `C${c1x.toFixed(2)},${c1y.toFixed(2)} ${c2x.toFixed(2)},${c2y.toFixed(2)} ${p2[0].toFixed(2)},${p2[1].toFixed(2)}`;
  }
  return d;
}

/**
 * Smooth area chart. `mini` drops ticks, markers and the callout (for list
 * rows). Long holes in otherwise frequent data break the line.
 */
export function CurveChart({
  id,
  points,
  format,
  tickLabel,
  callout,
  height = 180,
  ticks = 5,
  markers = true,
  mini = false,
  refLine,
}: {
  id: string;
  points: Point[];
  format: (v: number) => string;
  tickLabel?: (date: string) => string;
  /** Label shown in the dark bubble above the latest point. */
  callout?: string;
  /** Pixels, or "fill" to take the parent's height. */
  height?: number | "fill";
  ticks?: number;
  markers?: boolean;
  mini?: boolean;
  /** Dashed horizontal reference, e.g. the period average. */
  refLine?: { value: number; label: string };
}) {
  if (points.length < 2) return null;
  const pts = thin(points, mini ? 30 : 70);
  const t0 = t(pts[0].date);
  const tN = t(pts[pts.length - 1].date) - t0 || 1;
  const vals = points.map((p) => p.value);
  const lo = Math.min(...vals);
  const hi = Math.max(...vals);
  const span = hi - lo || 1;
  const top = mini ? 8 : callout ? 26 : 14;
  const x = (d: string) => ((t(d) - t0) / tN) * 100;
  const y = (v: number) => top + (1 - (v - lo) / span) * (92 - top);

  // Split into segments at long holes.
  const segs: Point[][] = [[]];
  const gaps: [Point, Point][] = [];
  pts.forEach((p, i) => {
    const prev = pts[i - 1];
    const before = pts[i - 2];
    // A hole only counts in otherwise frequent (daily-ish) data.
    if (prev && before && t(p.date) - t(prev.date) > 45 * DAY && t(prev.date) - t(before.date) <= 10 * DAY) {
      segs.push([]);
      gaps.push([prev, p]);
    }
    segs[segs.length - 1].push(p);
  });
  const lines = segs.filter((s) => s.length > 1).map((s) => smooth(s.map((p) => [x(p.date), y(p.value)])));
  const areas = segs
    .filter((s) => s.length > 1)
    .map((s, i) => `${lines[i]}L${x(s[s.length - 1].date).toFixed(2)},100L${x(s[0].date).toFixed(2)},100Z`);

  const last = points[points.length - 1];
  const lastX = x(last.date);
  const lastY = y(last.value);
  const hiP = points.reduce((a, b) => (b.value > a.value ? b : a));
  const loP = points.reduce((a, b) => (b.value < a.value ? b : a));
  const far = (p: Point) => Math.abs(x(p.date) - lastX) > 12;
  const tickDates = tickLabel ? Array.from({ length: ticks }, (_, i) => new Date(t0 + (tN * i) / (ticks - 1)).toISOString().slice(0, 10)) : [];

  const filled = height === "fill";
  return (
    <div className={filled ? "flex h-full flex-col" : undefined}>
      <div className={`relative ${filled ? "min-h-0 flex-1" : ""}`} style={filled ? undefined : { height }}>
        {refLine && (
          <div className="absolute inset-x-0 border-t border-dashed border-faint/80" style={{ top: `${y(refLine.value)}%` }} aria-hidden="true">
            <span className="absolute left-0 -translate-y-full rounded bg-card/85 px-1 pb-0.5 text-[10px] text-faint">{refLine.label}</span>
          </div>
        )}
        <svg
          viewBox="0 0 100 100"
          preserveAspectRatio="none"
          className="absolute inset-0 size-full animate-[reveal-x_1.4s_var(--ease-out-soft)_both] overflow-visible"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id={`g-${id}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--color-primary-mark)" stopOpacity={mini ? 0.16 : 0.22} />
              <stop offset="100%" stopColor="var(--color-primary-mark)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {areas.map((d, i) => (
            <path key={`a${i}`} d={d} fill={`url(#g-${id})`} className="animate-fade" style={{ animationDelay: "300ms" }} />
          ))}
          {lines.map((d, i) => (
            <path
              key={`l${i}`}
              d={d}
              fill="none"
              stroke="var(--color-primary-mark)"
              strokeWidth={mini ? 1.6 : 2.2}
              strokeLinecap="round"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {/* dashed bridge across missing data */}
          {gaps.map(([a, b], i) => (
            <line
              key={`gap${i}`}
              x1={x(a.date)}
              y1={y(a.value)}
              x2={x(b.date)}
              y2={y(b.value)}
              stroke="var(--color-faint)"
              strokeWidth="1.5"
              strokeDasharray="3 4"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          {!mini && <line x1={lastX} x2={lastX} y1={lastY} y2="100" stroke="var(--color-primary-mark)" strokeOpacity="0.6" strokeDasharray="2 3" vectorEffect="non-scaling-stroke" />}
        </svg>

        {/* high / low chips */}
        {!mini &&
          markers &&
          [
            { p: hiP, tag: "High", above: true },
            { p: loP, tag: "Low", above: false },
          ]
            // skip chips close to, or equal to, today's point: the callout covers them
            .filter(({ p }) => far(p) && p.value !== last.value)
            .map(({ p, tag, above }) => {
              const px = x(p.date);
              return (
                <span key={tag} className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${px}%`, top: `${y(p.value)}%` }}>
                  <span className="block size-2.5 rounded-full border-2 border-primary-mark bg-card" />
                  <span
                    className={`absolute rounded-full bg-card px-2 py-0.5 text-[10px] whitespace-nowrap text-muted shadow-card ${above ? "bottom-full mb-1.5" : "top-full mt-1.5"} ${
                      px < 15 ? "left-0" : px > 85 ? "right-0" : "left-1/2 -translate-x-1/2"
                    }`}
                  >
                    {tag} <strong className="font-semibold text-ink tabular-nums">{format(p.value)}</strong>
                  </span>
                </span>
              );
            })}

        {/* latest point + dark callout */}
        <span className="absolute -translate-x-1/2 -translate-y-1/2" style={{ left: `${lastX}%`, top: `${lastY}%` }}>
          <span
            className={`block rounded-full border-2 border-card bg-primary-mark ${mini ? "size-2" : "size-3.5 shadow-[0_0_0_5px_color-mix(in_srgb,var(--color-primary-mark)_18%,transparent)]"}`}
          />
          {callout && (
            <span className="absolute right-[-6px] bottom-full mb-2.5 flex flex-col items-end">
              <span className="animate-pop rounded-xl bg-ink px-2.5 py-1.5 text-left whitespace-nowrap text-canvas shadow-pop">
                <span className="block text-[10px] opacity-70">{callout}</span>
                <span className="block text-[13px] font-semibold tabular-nums">{format(last.value)}</span>
              </span>
              <span className="mr-3 size-2 -translate-y-1 rotate-45 bg-ink" />
            </span>
          )}
        </span>
      </div>

      {tickDates.length > 0 && (
        <div className="relative mt-3 h-6 text-[10px] tracking-wide whitespace-nowrap text-faint uppercase">
          {tickDates.map((d, i) => (
            <span
              key={d}
              className={`absolute flex flex-col ${i === 0 ? "items-start" : i === tickDates.length - 1 ? "-translate-x-full items-end" : "-translate-x-1/2 items-center"}`}
              style={{ left: `${(i / (tickDates.length - 1)) * 100}%` }}
            >
              <span className="mb-1 h-1.5 w-px bg-line" />
              {tickLabel!(d)}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Capsule bars for recent rate decisions: a rounded track, filled to the
 * rate, with the top capped rose for a rise and emerald for a cut.
 */
export function CapsuleBars({ steps }: { steps: { date: string; label: string; rate: number; change: number }[] }) {
  const max = Math.max(...steps.map((s) => s.rate), 0.5);
  return (
    <div>
      <div className="flex h-24 items-end justify-between gap-2" role="img" aria-label="Cash rate at recent Board decisions">
        {steps.map((s, i) => {
          const latest = i === steps.length - 1;
          const cap = s.change > 0 ? "bg-bad-mark" : s.change < 0 ? "bg-good-mark" : undefined;
          return (
            <div key={s.date} className="group relative flex h-full flex-1 justify-center" title={`${s.label}: ${s.rate.toFixed(2)}%`}>
              <div className="relative h-full w-2.5 overflow-hidden rounded-full bg-chip">
                <div
                  className={`animate-grow-y absolute inset-x-0 bottom-0 origin-bottom overflow-hidden rounded-full ${latest ? "bg-primary-mark" : "bg-soft"}`}
                  style={{ height: `${(s.rate / max) * 100}%`, animationDelay: `${i * 60}ms` }}
                >
                  {cap && <span className={`absolute inset-x-0 top-0 h-3 rounded-full ${cap}`} />}
                </div>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-2 flex justify-between gap-2 text-[10px] text-faint">
        {steps.map((s, i) => (
          <span key={s.date} className={`flex-1 text-center ${i === steps.length - 1 ? "font-semibold text-ink" : ""}`}>
            {s.label}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Panel rows: white rows floating on a tinted panel, like the reference's lists. */
export function FloatList({ children }: { children: ReactNode }) {
  return <ul className="space-y-2.5 rounded-[16px] bg-mist p-2.5">{children}</ul>;
}

export function FloatRow({
  href,
  icon,
  title,
  subtitle,
  value,
  status,
  chart,
  delay = 0,
}: {
  href: string;
  icon: ReactNode;
  title: string;
  subtitle: string;
  value: ReactNode;
  status: ReactNode;
  chart: ReactNode;
  delay?: number;
}) {
  return (
    <li className="animate-rise" style={{ animationDelay: `${delay}ms` }}>
      <Link
        href={href}
        className="group grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-4 rounded-[12px] bg-card px-4 py-3.5 shadow-card transition duration-300 hover:-translate-y-0.5 hover:shadow-pop sm:grid-cols-[auto_minmax(0,1fr)_8rem_auto_auto]"
      >
        {icon}
        <span className="min-w-0">
          <span className="block truncate text-[15px] font-medium">{title}</span>
          <span className="block truncate text-xs text-faint">{subtitle}</span>
        </span>
        <span className="hidden sm:block">{chart}</span>
        <span className="text-right">
          <span className="block">{value}</span>
          <span className="block">{status}</span>
        </span>
        <span className="hidden size-10 place-items-center rounded-full bg-inset text-primary transition group-hover:bg-primary-solid group-hover:text-on-primary-solid sm:grid" aria-hidden="true">
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M2.5 11.5l4-4 2.5 2.5 4.5-5M10 5h3.5v3.5" />
          </svg>
        </span>
      </Link>
    </li>
  );
}
