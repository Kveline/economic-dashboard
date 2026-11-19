import type { ReactNode } from "react";
import type { Tone } from "@/lib/data/indicators";

/** Pale card on the white canvas: no border, no shadow. */
export function Card({ children, className = "" }: { children: ReactNode; className?: string }) {
  return <section className={`min-w-0 rounded-[20px] bg-card p-6 shadow-card ${className}`}>{children}</section>;
}

export function CardTitle({ children, aside }: { children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="mb-5 flex items-center justify-between gap-4">
      <h2 className="text-[20px] leading-tight font-medium tracking-tight">{children}</h2>
      {aside && <span className="shrink-0 rounded-full bg-inset px-3 py-1.5 text-xs text-muted">{aside}</span>}
    </div>
  );
}

export function Eyebrow({ children }: { children: ReactNode }) {
  return <p className="text-xs text-faint">{children}</p>;
}

const toneText: Record<Tone, string> = {
  good: "text-good",
  bad: "text-bad",
  neutral: "text-muted",
};

export function toneClass(tone: Tone) {
  return toneText[tone];
}

export function Stat({
  label,
  value,
  caption,
  valueClass = "",
}: {
  label: string;
  value: ReactNode;
  caption?: ReactNode;
  valueClass?: string;
}) {
  return (
    <div className="min-w-0">
      <Eyebrow>{label}</Eyebrow>
      <p className={`mt-1 text-[22px] font-medium tracking-tight tabular-nums ${valueClass}`}>{value}</p>
      {caption && <p className="mt-0.5 text-xs text-faint">{caption}</p>}
    </div>
  );
}

export function Unavailable({ title, error }: { title: string; error?: string }) {
  return (
    <div className="flex h-full flex-col justify-center gap-1">
      {title && <p className="text-sm text-muted">{title}</p>}
      <p className="text-sm text-faint">Data is temporarily unavailable. We&apos;ll try again shortly.</p>
      {error && process.env.NODE_ENV === "development" && (
        <p className="mt-2 font-mono text-[11px] break-all text-bad/80">{error}</p>
      )}
    </div>
  );
}

/** Quiet table: hairline under the header, soft row highlight on hover. */
export function Table({
  head,
  rows,
  align,
}: {
  head: string[];
  rows: ReactNode[][];
  align?: ("left" | "right")[];
}) {
  const cls = (i: number) => (align?.[i] === "right" ? "text-right" : "text-left");
  return (
    <table className="-mx-3 w-[calc(100%+1.5rem)] border-separate border-spacing-0 text-sm">
      <thead>
        <tr className="text-xs text-faint">
          {head.map((h, i) => (
            <th key={h} scope="col" className={`border-b border-line px-3 pb-2.5 font-normal ${cls(i)}`}>
              {h}
            </th>
          ))}
        </tr>
      </thead>
      <tbody>
        {rows.map((r, ri) => (
          <tr key={ri} className="transition-colors hover:bg-inset">
            {r.map((c, ci) => (
              <td key={ci} className={`px-3 py-3 tabular-nums first:rounded-l-xl last:rounded-r-xl ${cls(ci)}`}>
                {c}
              </td>
            ))}
          </tr>
        ))}
      </tbody>
    </table>
  );
}
