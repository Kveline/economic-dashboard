"use client";

import { createContext, use, useTransition, type ReactNode, type TransitionStartFunction } from "react";

const PendingContext = createContext<{ pending: boolean; startTransition: TransitionStartFunction } | null>(null);

/**
 * Shares one navigation transition between the date switcher and the content
 * it changes, so the cards can dim softly while the new date loads.
 */
export function PendingProvider({ children }: { children: ReactNode }) {
  const [pending, startTransition] = useTransition();
  return <PendingContext value={{ pending, startTransition }}>{children}</PendingContext>;
}

export function usePending() {
  const ctx = use(PendingContext);
  if (!ctx) throw new Error("usePending must be used inside <PendingProvider>");
  return ctx;
}

export function PendingArea({ children }: { children: ReactNode }) {
  const { pending } = usePending();
  return (
    <div
      aria-busy={pending}
      className={`transition-[opacity,filter] duration-300 ease-out ${pending ? "pointer-events-none opacity-45 blur-[1.5px]" : ""}`}
    >
      {children}
    </div>
  );
}
