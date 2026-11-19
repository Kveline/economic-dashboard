import type { Point } from "@/lib/series";

/**
 * A tiny axis-free trend line (pure SVG, server-rendered). The line draws in
 * on load and the latest point is marked.
 */
export function MiniSpark({
  points,
  height = 44,
  label,
  color = "var(--color-bright)",
}: {
  points: Point[];
  height?: number;
  label: string;
  color?: string;
}) {
  if (points.length < 2) return null;
  const w = 200;
  const pad = 4;
  const values = points.map((p) => p.value);
  const min = Math.min(...values);
  const max = Math.max(...values);
  const span = max - min || 1;
  const x = (i: number) => (i / (points.length - 1)) * w;
  const y = (v: number) => pad + (1 - (v - min) / span) * (height - pad * 2);
  const d = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.value).toFixed(1)}`).join("");
  const last = points[points.length - 1];
  const gradientId = `mini-${color.replace(/[^a-z0-9]/gi, "")}`;

  return (
    <div className="relative">
      {/* The line is revealed left to right on load. */}
      <div className="animate-[reveal-x_1.4s_var(--ease-out-soft)_200ms_both]">
      <svg
      viewBox={`0 0 ${w} ${height}`}
      preserveAspectRatio="none"
      className="w-full overflow-visible"
      style={{ height }}
      role="img"
      aria-label={label}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.14" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={`${d}L${w},${height}L0,${height}Z`} fill={`url(#${gradientId})`} className="animate-fade" style={{ animationDelay: "500ms" }} />
      <path
        d={d}
        fill="none"
        stroke={color}
        strokeOpacity={0.85}
        strokeWidth="1.5"
        vectorEffect="non-scaling-stroke"
        strokeLinejoin="round"
      />
    </svg>
      </div>
      <span
        aria-hidden="true"
        className="animate-fade absolute size-1.5 -translate-x-1/2 -translate-y-1/2 rounded-full"
        style={{ background: color, boxShadow: `0 0 0 4px color-mix(in srgb, ${color} 18%, transparent)`, left: "100%", top: `${(y(last.value) / height) * 100}%`, animationDelay: "1000ms" }}
      />
    </div>
  );
}
