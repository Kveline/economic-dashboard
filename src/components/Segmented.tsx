"use client";

/** Pill segmented control with a blue highlight that slides to the selection. */
export function Segmented<T extends string>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: { key: T; label: string }[];
  value: T;
  onChange: (key: T) => void;
}) {
  const index = Math.max(0, options.findIndex((o) => o.key === value));

  return (
    <div
      role="radiogroup"
      aria-label={label}
      className="relative inline-grid rounded-full bg-inset p-1 ring-1 ring-line"
      style={{ gridTemplateColumns: `repeat(${options.length}, minmax(3.5rem, 1fr))` }}
      onKeyDown={(e) => {
        if (e.key !== "ArrowRight" && e.key !== "ArrowLeft") return;
        e.preventDefault();
        const next = (index + (e.key === "ArrowRight" ? 1 : -1) + options.length) % options.length;
        onChange(options[next].key);
        (e.currentTarget.querySelectorAll("button")[next] as HTMLButtonElement | undefined)?.focus();
      }}
    >
      <span
        aria-hidden="true"
        className="absolute inset-y-1 left-1 rounded-full bg-primary transition-transform duration-500 ease-[var(--ease-out-soft)]"
        style={{
          width: `calc((100% - 0.5rem) / ${options.length})`,
          transform: `translateX(${index * 100}%)`,
        }}
      />
      {options.map((o) => (
        <button
          key={o.key}
          type="button"
          role="radio"
          aria-checked={o.key === value}
          tabIndex={o.key === value ? 0 : -1}
          onClick={() => onChange(o.key)}
          className={`relative z-10 rounded-full px-4 py-2 text-[13px] font-medium transition-colors duration-300 ${
            o.key === value ? "text-on-primary" : "text-muted hover:text-ink"
          }`}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
