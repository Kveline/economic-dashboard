"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

const query = "(prefers-reduced-motion: reduce)";

/** True when the user has asked the OS for less motion. */
export function useReducedMotion(): boolean {
  return useSyncExternalStore(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

const easeOutCubic = (t: number) => 1 - (1 - t) ** 3;

/**
 * Returns `value`, but when it changes, eases from the old value to the new
 * one over `duration` ms. The first render returns the final value, so
 * server-rendered numbers never flicker.
 */
function useTween(value: number, duration: number): number {
  const [shown, setShown] = useState(value);
  const from = useRef(value);
  const reduced = useReducedMotion();

  useEffect(() => {
    const start = from.current;
    from.current = value;
    if (reduced || start === value) {
      setShown(value);
      return;
    }
    let raf = 0;
    const t0 = performance.now();
    const tick = (now: number) => {
      const t = Math.min(1, (now - t0) / duration);
      setShown(start + (value - start) * easeOutCubic(t));
      if (t < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value, duration, reduced]);

  return shown;
}

/** A number (fixed decimals) that counts smoothly to its new value when it changes. */
export function AnimatedNumber({ value, digits, duration = 700 }: { value: number; digits: number; duration?: number }) {
  return <>{useTween(value, duration).toFixed(digits).replace("-", "−")}</>;
}
