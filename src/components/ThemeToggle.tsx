"use client";

import { useSyncExternalStore } from "react";

type Theme = "light" | "dark";

function read(): Theme {
  return document.documentElement.dataset.theme === "dark" ? "dark" : "light";
}

function subscribe(cb: () => void) {
  const obs = new MutationObserver(cb);
  obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  return () => obs.disconnect();
}

/**
 * Moon / sun button that switches between light and dark and remembers it.
 * Choosing the theme the system already uses forgets the saved choice, so
 * the site goes back to following the system (see the script in layout.tsx).
 */
export function ThemeToggle() {
  const theme = useSyncExternalStore(subscribe, read, () => "light" as Theme);
  const next: Theme = theme === "dark" ? "light" : "dark";

  return (
    <button
      type="button"
      onClick={() => {
        document.documentElement.dataset.theme = next;
        const system: Theme = matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
        try {
          if (next === system) localStorage.removeItem("theme");
          else localStorage.setItem("theme", next);
        } catch {
          // storage unavailable: the choice lasts for this page only
        }
      }}
      aria-label={`Switch to ${next} mode`}
      title={`Switch to ${next} mode`}
      className="grid size-10 place-items-center rounded-full bg-card text-muted shadow-card transition hover:text-primary"
    >
      <svg viewBox="0 0 24 24" className="size-[19px]" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {theme === "dark" ? (
          <>
            <circle cx="12" cy="12" r="4" />
            <path d="M12 2.5v2M12 19.5v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M2.5 12h2M19.5 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
          </>
        ) : (
          <path d="M20 14.5A8 8 0 019.5 4a8 8 0 1010.5 10.5z" />
        )}
      </svg>
    </button>
  );
}
