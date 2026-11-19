import Link from "next/link";
import type { ReactNode } from "react";
import { ThemeToggle } from "./ThemeToggle";

/**
 * The page frame shared by every page: no outer panel, the cards sit
 * straight on the off-white page; a top row, then a hero, then the content.
 */
export function Shell({
  topLeft,
  topRight,
  hero,
  compact = false,
  children,
}: {
  topLeft: ReactNode;
  topRight?: ReactNode;
  hero: ReactNode;
  /** Tighter top band, for detail pages where the data matters more than the title. */
  compact?: boolean;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-page">
      <div className="mx-auto max-w-[1280px] px-3 pt-5 pb-16 sm:px-6 sm:pt-8 lg:px-10">
        <div className={`px-2 sm:px-6 ${compact ? "pb-8 sm:pb-10" : "pb-10 sm:pb-14"}`}>
          <div className="flex flex-wrap items-start justify-between gap-6">
            <div className="animate-rise min-w-0">{topLeft}</div>
            <div className="flex items-center gap-2">
              {topRight}
              <ThemeToggle />
            </div>
          </div>
          <div className={`animate-rise ${compact ? "mt-8 lg:mt-10" : "mt-12 lg:mt-16"}`} style={{ animationDelay: "120ms" }}>
            {hero}
          </div>
        </div>
        <div>{children}</div>
      </div>
    </div>
  );
}

/** Big page title with an optional grey line under it. */
export function HeroTitle({
  eyebrow,
  title,
  lead,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  lead?: ReactNode;
}) {
  return (
    <>
      {eyebrow && <p className="mb-3 text-sm text-muted">{eyebrow}</p>}
      <h1 className="text-[34px] leading-[1.1] font-medium tracking-tight sm:text-[52px]">{title}</h1>
      {lead && <p className="mt-3 max-w-[44ch] text-[20px] leading-snug tracking-tight text-faint sm:text-[26px]">{lead}</p>}
    </>
  );
}

/**
 * Detail-page header: small tile beside the group label and title, with the
 * plain-English explainer at reading size underneath.
 */
export function DetailHeading({ tile, group, title, lead }: { tile: ReactNode; group: string; title: string; lead: string }) {
  return (
    <div className="flex items-start gap-4 sm:gap-5">
      <div className="mt-1">{tile}</div>
      <div className="min-w-0">
        <p className="text-[13px] text-faint">{group}</p>
        <h1 className="mt-0.5 text-[28px] leading-tight font-medium tracking-tight sm:text-[34px]">{title}</h1>
        <p className="mt-2 max-w-[62ch] text-[15px] leading-6 text-muted">{lead}</p>
      </div>
    </div>
  );
}

/** "● Live data · RBA & ABS" */
export function LivePill() {
  return (
    <span className="hidden items-center gap-2 rounded-full bg-card px-4 py-2.5 text-xs text-muted shadow-card sm:inline-flex">
      <span className="animate-pulse-dot size-2 rounded-full bg-good-mark" aria-hidden="true" />
      Live data · RBA &amp; ABS
    </span>
  );
}

/** "← All indicators" pill. */
export function BackPill() {
  return (
    <Link
      href="/"
      className="group inline-flex items-center gap-2 rounded-full bg-card py-2.5 pr-5 pl-4 text-sm font-medium shadow-card transition hover:text-primary"
    >
      <svg
        viewBox="0 0 16 16"
        className="size-4 text-primary transition-transform duration-300 group-hover:-translate-x-0.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.8"
        aria-hidden="true"
      >
        <path d="M13 8H3M7 4L3 8l4 4" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
      All indicators
    </Link>
  );
}
