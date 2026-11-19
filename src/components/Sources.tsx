import type { SourceId } from "@/lib/data/indicators";

const SOURCES: Record<SourceId, { mark: string; name: string; provides: string; href: string }> = {
  rba: {
    mark: "RBA",
    name: "Reserve Bank of Australia",
    provides: "Exchange rates · cash rate",
    href: "https://www.rba.gov.au/statistics/",
  },
  abs: {
    mark: "ABS",
    name: "Australian Bureau of Statistics",
    provides: "Inflation · jobs · GDP",
    href: "https://www.abs.gov.au/statistics",
  },
  goldapi: { mark: "Au", name: "gold-api.com", provides: "Live gold price", href: "https://gold-api.com" },
  freegold: { mark: "Au", name: "freegoldapi.com", provides: "Gold price history", href: "https://freegoldapi.com" },
};

/** "Where the numbers come from": one card per source, plus a freshness note. */
export function Sources({ ids, note, icon = "refresh" }: { ids: SourceId[]; note: string; icon?: "refresh" | "clock" }) {
  return (
    <footer className="mt-8 px-1 pb-2 sm:mt-10" aria-labelledby="sources-title">
      <div className="flex flex-wrap items-baseline justify-between gap-x-6 gap-y-2 px-2">
        <h2 id="sources-title" className="text-sm font-medium">
          Where the numbers come from
        </h2>
        <p className="flex items-center gap-1.5 text-xs text-muted">
          <svg viewBox="0 0 16 16" className="size-3.5" fill="none" stroke="currentColor" strokeWidth="1.6" aria-hidden="true">
            {icon === "refresh" ? (
              <path d="M13.5 8A5.5 5.5 0 113 5M3 2v3h3" strokeLinecap="round" strokeLinejoin="round" />
            ) : (
              <>
                <circle cx="8" cy="8" r="5.5" />
                <path d="M8 5v3l2 1.5" strokeLinecap="round" strokeLinejoin="round" />
              </>
            )}
          </svg>
          {note}
        </p>
      </div>
      <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-4">
        {ids.map((id) => {
          const src = SOURCES[id];
          return (
            <li key={id}>
              <a
                href={src.href}
                target="_blank"
                rel="noreferrer"
                className="group flex items-center gap-3 rounded-2xl bg-card px-4 py-3 shadow-card transition hover:-translate-y-0.5"
              >
                <span className="grid size-10 shrink-0 place-items-center rounded-full bg-primary-tint text-[11px] font-bold tracking-wide text-primary">
                  {src.mark}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-[13px] font-medium">{src.name}</span>
                  <span className="block truncate text-xs text-faint">{src.provides}</span>
                </span>
                <svg
                  viewBox="0 0 16 16"
                  className="size-3.5 shrink-0 text-faint transition group-hover:translate-x-0.5 group-hover:-translate-y-0.5 group-hover:text-primary"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  aria-hidden="true"
                >
                  <path d="M5 11l6-6M6 5h5v5" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span className="sr-only">(opens in a new tab)</span>
              </a>
            </li>
          );
        })}
      </ul>
    </footer>
  );
}
