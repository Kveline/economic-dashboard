"use client";

import { useRouter } from "next/navigation";
import { useRef } from "react";
import { usePending } from "./Pending";

export type ViewOption = {
  key: string;
  /** Full label, e.g. "5 years ago". */
  label: string;
  /** Compact label for narrow screens, e.g. "5 yrs". */
  short: string;
  /** Extra context for the tooltip, e.g. "Nov 2021". */
  detail?: string;
};

const hrefFor = (key: string) => (key === "now" ? "/" : `/?view=${key}`);

/**
 * "See the economy as it was": a labelled segmented control. All choices are
 * visible, so what it does is obvious, and one click switches the whole page.
 */
export function ViewSwitcher({ options, current }: { options: ViewOption[]; current: string }) {
  const router = useRouter();
  const { pending, startTransition } = usePending();
  const groupRef = useRef<HTMLDivElement>(null);
  const index = Math.max(0, options.findIndex((o) => o.key === current));

  const choose = (key: string) => {
    if (key === current) return;
    startTransition(() => router.push(hrefFor(key), { scroll: false }));
  };

  return (
    <div className="min-w-0">
      <div
        ref={groupRef}
        role="radiogroup"
        aria-label="See the economy as it was"
        aria-busy={pending}
        className={`relative grid rounded-full bg-card p-1 shadow-card transition-opacity ${
          pending ? "opacity-70" : ""
        }`}
        style={{ gridTemplateColumns: `repeat(${options.length}, minmax(0, 1fr))` }}
        onKeyDown={(e) => {
          if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
          e.preventDefault();
          const next = (index + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
          groupRef.current?.querySelectorAll("button")[next]?.focus();
          choose(options[next].key);
        }}
      >
        {/* sliding highlight */}
        <span
          aria-hidden="true"
          className="absolute inset-y-1 left-1 rounded-full bg-primary shadow-[0_6px_14px_-6px_color-mix(in_srgb,var(--color-primary)_70%,transparent)] transition-transform duration-500 ease-[var(--ease-out-soft)]"
          style={{ width: `calc((100% - 0.5rem) / ${options.length})`, transform: `translateX(${index * 100}%)` }}
        />
        {options.map((o) => {
          const selected = o.key === current;
          return (
            <button
              key={o.key}
              type="button"
              role="radio"
              aria-checked={selected}
              tabIndex={selected ? 0 : -1}
              title={o.detail ? `${o.label} · ${o.detail}` : o.label}
              onClick={() => choose(o.key)}
              onMouseEnter={() => router.prefetch(hrefFor(o.key))}
              className={`relative z-10 rounded-full px-3 py-2 text-[13px] font-medium whitespace-nowrap transition-colors duration-300 sm:px-4 ${
                selected ? "text-on-primary" : "text-muted hover:text-ink"
              }`}
            >
              <span className="sm:hidden">{o.short}</span>
              <span className="hidden sm:inline">{o.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
