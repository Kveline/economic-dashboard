"use client";

import { useId, useState } from "react";

/**
 * A small "?" that explains a term in plain English. Opens on hover, keyboard
 * focus, or tap.
 */
export function InfoTip({ label, children }: { label: string; children: string }) {
  const id = useId();
  const [open, setOpen] = useState(false);
  return (
    <span
      className="relative inline-flex align-middle"
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => setOpen(false)}
    >
      <button
        type="button"
        aria-label={`What is ${label}?`}
        aria-describedby={open ? id : undefined}
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        onFocus={() => setOpen(true)}
        onBlur={() => setOpen(false)}
        className="relative z-10 grid size-[18px] place-items-center rounded-full border border-faint/70 text-[10px] font-bold text-faint transition hover:border-muted hover:text-ink"
      >
        ?
      </button>
      {open && (
        <span
          id={id}
          role="tooltip"
          className="animate-pop absolute top-full left-1/2 z-30 mt-2.5 w-64 -translate-x-1/2 rounded-xl bg-card p-3.5 text-left text-xs leading-5 font-normal text-muted shadow-pop ring-1 ring-line"
        >
          {children}
        </span>
      )}
    </span>
  );
}
