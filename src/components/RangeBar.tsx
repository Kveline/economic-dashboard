import { Card } from "./ui";

type Mark = { value: number; date: string };

/**
 * "Where this sits": today's value on the past year's low–high range, with a
 * plain-English verdict, the average as a tick, the marker's label attached
 * to it, and how far today is from each end.
 */
export function RangeBar({
  title,
  low,
  high,
  now,
  average,
  format,
}: {
  title: string;
  low: Mark;
  high: Mark;
  now: number;
  average: number;
  format: (v: number) => string;
}) {
  const span = high.value - low.value || 1;
  const pos = Math.min(100, Math.max(0, ((now - low.value) / span) * 100));
  const avgPos = Math.min(100, Math.max(0, ((average - low.value) / span) * 100));
  const atLow = now <= low.value;
  const atHigh = now >= high.value;
  const verdict = atLow
    ? "the lowest of"
    : atHigh
      ? "the highest of"
      : pos < 8
        ? "near the bottom of"
        : pos < 34
          ? "in the lower part of"
          : pos > 92
            ? "near the top of"
            : pos > 66
              ? "in the upper part of"
              : "around the middle of";
  // Distance from each reference, as a % of that reference.
  const from = (ref: number) => ((now - ref) / ref) * 100;
  const stats = [
    { label: "from the year's high", value: from(high.value), same: atHigh, sameText: "at the high" },
    { label: "from the average", value: from(average), same: Math.abs(from(average)) < 0.5, sameText: "about average" },
    { label: "from the year's low", value: from(low.value), same: atLow, sameText: "at the low" },
  ];
  const pct = (v: number) => `${v > 0 ? "+" : "−"}${Math.abs(v).toFixed(0)}%`;
  // Keep the "today" label inside the card at the ends.
  const labelShift = pos < 12 ? "translate-x-0" : pos > 88 ? "-translate-x-full" : "-translate-x-1/2";

  return (
    <Card className="flex flex-col">
      <h2 className="text-[17px] font-medium tracking-tight">{title}</h2>
      <p className="mt-1 text-sm text-muted">
        Today&apos;s price is <span className="font-medium text-ink">{verdict}</span> the past year&apos;s range.
      </p>

      <div
        className="relative mt-11"
        role="img"
        aria-label={`${format(now)} today, between a low of ${format(low.value)} and a high of ${format(high.value)}; average ${format(average)}`}
      >
        {/* today, attached to its dot */}
        <span className={`absolute -top-7 ${labelShift} text-xs whitespace-nowrap text-muted`} style={{ left: `${pos}%` }} aria-hidden="true">
          Today <span className="font-medium text-ink tabular-nums">{format(now)}</span>
        </span>
        <div className="relative h-1.5 rounded-full bg-soft/45" aria-hidden="true">
          {/* the stretch between today and the average, lightly tinted */}
          <span
            className="absolute inset-y-0 rounded-full bg-accent"
            style={{ left: `${Math.min(pos, avgPos)}%`, width: `${Math.abs(avgPos - pos)}%` }}
          />
          {/* average tick */}
          <span className="absolute -top-1.5 -bottom-1.5 w-px -translate-x-1/2 bg-faint" style={{ left: `${avgPos}%` }} />
          <span
            className="animate-fade absolute top-1/2 size-4 -translate-x-1/2 -translate-y-1/2 rounded-full border-[3px] border-card bg-primary-mark ring-4 ring-primary-mark/15"
            style={{ left: `${pos}%`, animationDelay: "300ms" }}
          />
        </div>
        <span className="absolute top-4 -translate-x-1/2 text-[11px] whitespace-nowrap text-faint" style={{ left: `${avgPos}%` }} aria-hidden="true">
          avg <span className="tabular-nums">{format(average)}</span>
        </span>
      </div>

      {/* the two ends of the range */}
      <div className="mt-9 flex justify-between gap-4 text-xs">
        <p>
          <span className="text-faint">Low</span> <span className="font-medium text-ink tabular-nums">{format(low.value)}</span>
          <span className="block text-faint">{low.date}</span>
        </p>
        <p className="text-right">
          <span className="text-faint">High</span> <span className="font-medium text-ink tabular-nums">{format(high.value)}</span>
          <span className="block text-faint">{high.date}</span>
        </p>
      </div>

      {/* how far today is from each reference */}
      <dl className="mt-5 grid grid-cols-3 divide-x divide-line border-t border-line pt-4">
        {stats.map((st) => (
          <div key={st.label} className="flex flex-col-reverse px-3 first:pl-0 last:pr-0 sm:px-5">
            <dt className="mt-0.5 text-xs text-faint">{st.label}</dt>
            <dd className={`text-[17px] leading-tight font-medium tracking-tight tabular-nums ${st.same ? "text-ink" : st.value > 0 ? "text-good" : "text-bad"}`}>
              {st.same ? st.sameText : pct(st.value)}
            </dd>
          </div>
        ))}
      </dl>
    </Card>
  );
}
