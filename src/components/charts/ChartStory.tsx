"use client";

import type { ChartStory as Story, StoryPoint } from "@/lib/narrative";
import type { Point } from "@/lib/series";

const toneSoft = { good: "bg-good-tint-strong text-good", bad: "bg-bad-tint-strong text-bad", neutral: "bg-inset text-muted" } as const;

/**
 * "What the chart shows", drawn instead of written: start → now with the
 * change, the low and the high as tiles (hover or tap one to pin it on the
 * chart), an indicator-specific extra, and the context in one line. The full
 * sentence version is kept for screen readers.
 */
export function ChartStory({ story, onFocus }: { story: Story; onFocus: (p: Point | null) => void }) {
  const pin = (p: StoryPoint) => ({
    onMouseEnter: () => onFocus({ date: p.date, value: p.value }),
    onMouseLeave: () => onFocus(null),
    onFocus: () => onFocus({ date: p.date, value: p.value }),
    onBlur: () => onFocus(null),
  });

  return (
    <section className="mt-8 border-t border-line pt-6" aria-labelledby="story-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <h2 id="story-title" className="text-[20px] font-medium tracking-tight">
          What the chart shows
        </h2>
        <span className="rounded-full bg-inset px-3 py-1.5 text-xs text-muted">{story.span}</span>
      </div>
      <p className="sr-only">{story.text}</p>
      <p className="mt-1 text-sm text-muted" aria-hidden="true">
        {story.lead}.
      </p>

      <StatCards story={story} pin={pin} />

      {story.extra?.kind === "band" && (
        <div className="mt-3 rounded-[16px] bg-inset p-4 sm:p-5" aria-hidden="true">
          <div className="flex items-baseline justify-between gap-4 text-xs">
            <span className="text-muted">{story.extra.label[0].toUpperCase() + story.extra.label.slice(1)}</span>
            <span className="text-lg font-medium tracking-tight text-ink tabular-nums">{Math.round(story.extra.inside * 100)}%</span>
          </div>
          <div className="mt-2.5 h-2 overflow-hidden rounded-full bg-chip">
            <div className="animate-grow-x h-full origin-left rounded-full bg-good-mark" style={{ width: `${story.extra.inside * 100}%` }} />
          </div>
        </div>
      )}

      {story.extra?.kind === "moves" && <MovesTally {...story.extra} />}

      <div className="mt-3 flex items-start gap-3.5 rounded-[16px] bg-primary-tint px-4 py-4 sm:px-5" aria-hidden="true">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-primary-solid text-on-primary-solid">
          <svg viewBox="0 0 16 16" className="size-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
            <path d="M6 13.5h4M6.5 11.5h3M8 2.5a4 4 0 0 0-2.4 7.2c.5.4.9 1 .9 1.8h3c0-.8.4-1.4.9-1.8A4 4 0 0 0 8 2.5Z" />
          </svg>
        </span>
        <div className="min-w-0">
          <p className="text-xs font-medium text-primary">Why it matters</p>
          <p className="mt-1 text-[15px] leading-6 text-ink">{story.context}</p>
          {story.notes.map((n) => (
            <p key={n} className="mt-1 text-xs text-faint">
              {n}
            </p>
          ))}
        </div>
      </div>
    </section>
  );
}

type Pin = (p: StoryPoint) => {
  onMouseEnter: () => void;
  onMouseLeave: () => void;
  onFocus: () => void;
  onBlur: () => void;
};

/**
 * Four quiet cards: started, now, lowest, highest. Same style throughout;
 * only "now" carries colour. Hover a card to find it on the chart.
 */
function StatCards({ story, pin }: { story: Story; pin: Pin }) {
  const same = (a: StoryPoint, b: StoryPoint) => a.date === b.date && a.value === b.value;
  const cards: { label: string; icon: IconKind; point: StoryPoint; now?: boolean; note?: string }[] = [
    { label: "Started at", icon: "start", point: story.start },
    { label: "Now", icon: "now", point: story.end, now: true },
    { label: "Lowest", icon: "low", point: story.low, note: same(story.low, story.start) ? "Same as start" : undefined },
    { label: "Highest", icon: "high", point: story.high, note: same(story.high, story.start) ? "Same as start" : undefined },
  ];

  return (
    // Soft tiles; "now" sits on white with a ring so it reads first. Hover one to pin it on the chart.
    <div className="mt-5 grid grid-cols-2 gap-2 sm:gap-2.5 lg:grid-cols-4" aria-hidden="true">
      {cards.map(({ label, icon, point, now, note }) => (
        <button
          key={label}
          type="button"
          tabIndex={-1}
          {...pin(point)}
          className={`group flex flex-col rounded-[16px] p-4 text-left transition duration-300 sm:p-5 ${
            now ? "bg-card shadow-card ring-1 ring-primary/25" : "bg-inset hover:bg-chip"
          }`}
        >
          <span className="flex items-center justify-between gap-2">
            <span className="text-xs text-muted">{label}</span>
            <span
              className={`grid size-7 shrink-0 place-items-center rounded-full ${
                now ? "bg-primary-tint text-primary" : "bg-card text-muted shadow-card"
              }`}
            >
              <CardIcon kind={icon} className="" />
            </span>
          </span>
          <span className="mt-3 block text-[26px] leading-none font-medium tracking-tight text-ink tabular-nums">{point.valueText}</span>
          <span className="mt-2.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-faint">
            {point.when}
            {now && story.change.direction !== "flat" && (
              <span className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${toneSoft[story.change.tone]}`}>{story.change.text}</span>
            )}
            {note && <span className="rounded-full bg-card px-2 py-0.5 text-[11px] text-muted">{note}</span>}
          </span>
        </button>
      ))}
    </div>
  );
}

type IconKind = "start" | "now" | "low" | "high";

/** 14px line icons for the summary cards. */
function CardIcon({ kind, className }: { kind: IconKind; className: string }) {
  return (
    <svg viewBox="0 0 16 16" className={`size-3.5 shrink-0 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round">
      {kind === "start" && <path d="M3.5 14V2.5M3.5 3h8l-1.8 2.6L11.5 8.2h-8" />}
      {kind === "now" && (
        <>
          <circle cx="8" cy="8" r="2.2" fill="currentColor" stroke="none" />
          <circle cx="8" cy="8" r="5.5" />
        </>
      )}
      {kind === "low" && <path d="M8 2.5v8M4.5 7L8 10.5 11.5 7M3 13.5h10" />}
      {kind === "high" && <path d="M8 13.5v-8M4.5 9L8 5.5 11.5 9M3 2.5h10" />}
    </svg>
  );
}

function MovesTally({ ups, downs, holds }: { ups: number; downs: number; holds: number }) {
  const total = ups + downs + holds || 1;
  const seg = [
    { n: ups, cls: "bg-bad-mark", label: "raised" },
    { n: holds, cls: "bg-soft", label: "held" },
    { n: downs, cls: "bg-good-mark", label: "cut" },
  ];
  return (
    <div className="mt-3 rounded-[16px] bg-inset p-4 sm:p-5" aria-hidden="true">
      <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
        <p className="text-xs text-muted">Board decisions in this period</p>
        <p className="text-lg leading-none font-medium tracking-tight text-ink tabular-nums">{ups + downs + holds}</p>
      </div>
      <div className="mt-3 flex h-3 gap-1 overflow-hidden rounded-full">
        {seg
          .filter((s) => s.n > 0)
          .map((s, i) => (
            <div
              key={s.label}
              className={`animate-grow-x h-full origin-left rounded-full ${s.cls}`}
              style={{ width: `${(s.n / total) * 100}%`, animationDelay: `${i * 150}ms` }}
            />
          ))}
      </div>
      {/* One small stat per kind: count, label and share, keyed to the bar by colour */}
      <div className="mt-4 grid grid-cols-3 divide-x divide-line">
        {seg.map((s) => (
          <div key={s.label} className="px-3 first:pl-0 last:pr-0 sm:px-5">
            <p className="flex items-center gap-1.5 text-xs text-muted">
              <span className={`h-2.5 w-1 rounded-full ${s.cls}`} />
              {s.label[0].toUpperCase() + s.label.slice(1)}
            </p>
            <p className="mt-1.5 flex items-baseline gap-1.5">
              <span className="text-xl leading-none font-medium tracking-tight text-ink tabular-nums">{s.n}</span>
              <span className="text-xs text-faint tabular-nums">{Math.round((s.n / total) * 100)}%</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}
