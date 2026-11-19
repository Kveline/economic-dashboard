"use client";

import { useEffect, useId, useState, type CSSProperties, type KeyboardEvent, type PointerEvent, type ReactNode } from "react";
import { useReducedMotion } from "@/components/motion";
import { fmtMoney } from "@/lib/format";
import { Chip, Glyph, Panel, PanelHead, Pill, type GlyphName } from "./parts";

/** Arrow keys move between the radios of a pill group, like a native radio set. */
function arrowKeys<T extends string>(keys: T[], value: T, set: (k: T) => void) {
  return (e: KeyboardEvent<HTMLDivElement>) => {
    const step = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
    if (!step) return;
    e.preventDefault();
    const next = (keys.indexOf(value) + step + keys.length) % keys.length;
    set(keys[next]);
    (e.currentTarget.querySelectorAll<HTMLButtonElement>("[role=radio]")[next])?.focus();
  };
}

const easeOut = (t: number) => 1 - (1 - t) ** 3;

/**
 * Counts up to `target`: from about 90% of it just after load, from the old
 * value when it changes. The first render (so the server HTML too) is the
 * final value, and anyone who asked for less motion never sees it move.
 */
function useCountUp(target: number, duration = 900): number {
  const reduced = useReducedMotion();
  const [run, setRun] = useState({ to: target, from: target, p: 1 });
  const now = run.from + (run.to - run.from) * easeOut(run.p);
  // A new target restarts the run from wherever the number is now (state adjusted during render).
  if (run.to !== target) setRun({ to: target, from: now, p: 0 });

  // The intro: once mounted, count the last ~10% up to the price (read the
  // media query directly, since the hook reports "no preference" while hydrating).
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const raf = requestAnimationFrame(() => setRun((r) => (r.p >= 1 && r.from === r.to ? { to: r.to, from: r.to * 0.9, p: 0 } : r)));
    return () => cancelAnimationFrame(raf);
  }, []);

  useEffect(() => {
    if (reduced || run.from === run.to) return;
    let raf = 0;
    const t0 = performance.now();
    const tick = (t: number) => {
      const p = Math.min(1, (t - t0) / duration);
      setRun((r) => ({ ...r, p }));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [run.to, run.from, reduced, duration]);

  return reduced ? target : now;
}

/* ------------------------------------------------------------ Hero ---- */

export type UnitView = {
  key: "gram" | "ounce" | "kilo" | "usd";
  /** Button text, e.g. "Per gram". */
  button: string;
  /** Card title, e.g. "Price per gram". */
  title: string;
  amount: number;
  money: "A$" | "US$";
  digits: number;
  caption: string;
  currency: "AUD" | "USD";
  change?: number;
  changeLabel: string;
};

/**
 * "Total Balance" card: the latest price, big, counting up to its value,
 * with a row of unit pills under a sliding highlight thumb. The change chip
 * follows the unit: A$ units share one % move; US$ per ounce has its own.
 * `side` and `notes` describe the A$ per gram series, so they show for A$ units only.
 */
export function PriceHero({ units, date, side, notes }: { units: UnitView[]; date: string; side?: ReactNode; notes?: ReactNode }) {
  const [key, setKey] = useState<UnitView["key"]>("gram");
  const i = Math.max(0, units.findIndex((x) => x.key === key));
  const u = units[i];
  const keys = units.map((x) => x.key);
  const aud = u.currency === "AUD";
  const shown = useCountUp(u.amount);
  const thumb = { "--c4": i, "--c2": i % 2, "--r2": Math.floor(i / 2) } as CSSProperties;
  // One decimal, like every other chip, unless the move rounds to 0.0.
  const chip = <Chip value={u.change} label={u.changeLabel} digits={u.change !== undefined && Math.abs(u.change) < 0.05 ? 2 : 1} />;
  // With no move grid to show, the chip and record pill sit beside the number.
  const grid = aud ? side : undefined;

  return (
    <Panel labelledBy="price-title" className="flex flex-col">
      <PanelHead id="price-title" icon="bar" title={u.title} aside={<Pill icon="coin">{aud ? "A$ · AUD" : "US$ · USD"}</Pill>} />

      <div className="mt-7 flex flex-wrap items-end justify-between gap-x-6 gap-y-4">
        <div className="min-w-0">
          <p className="text-[42px] leading-none font-semibold tracking-[-0.035em] text-ink tabular-nums sm:text-[58px]" aria-hidden="true">
            {fmtMoney(shown, u.money, u.digits)}
          </p>
          <p className="sr-only" aria-live="polite">
            {u.title}: {fmtMoney(u.amount, u.money, u.digits)}
          </p>
          <p className="mt-3 text-sm text-muted">
            {u.caption} · {date}
          </p>
        </div>
        {grid ?? (
          <div className="flex min-w-0 flex-col items-start gap-2 sm:mb-0.5 sm:items-end">
            {chip}
            {aud && notes}
          </div>
        )}
      </div>

      {grid && (
        <div className="mt-4 flex flex-wrap items-center gap-2">
          {chip}
          {notes}
        </div>
      )}

      <div
        role="radiogroup"
        aria-label="Show the price per"
        className="relative isolate mt-7 grid grid-cols-2 gap-1 rounded-[26px] bg-inset p-1 shadow-[inset_0_1px_2px_rgb(15_23_42/0.06)] sm:grid-cols-4 sm:rounded-full"
        onKeyDown={arrowKeys(keys, key, setKey)}
      >
        {/* the selected pill: one thumb that slides to the chosen unit */}
        <span
          className="absolute top-1 left-1 -z-10 h-[calc((100%-12px)/2)] w-[calc((100%-12px)/2)] translate-x-[calc(var(--c2)*(100%+4px))] translate-y-[calc(var(--r2)*(100%+4px))] rounded-full bg-primary shadow-[0_6px_18px_-4px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.25)] transition-[translate] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] sm:h-[calc(100%-8px)] sm:w-[calc((100%-20px)/4)] sm:translate-x-[calc(var(--c4)*(100%+4px))] sm:translate-y-0"
          style={thumb}
          aria-hidden="true"
        />
        {units.map((x) => {
          const on = x.key === key;
          return (
            <button
              key={x.key}
              type="button"
              role="radio"
              aria-checked={on}
              tabIndex={on ? 0 : -1}
              onClick={() => setKey(x.key)}
              className={`flex h-11 min-w-0 items-center justify-center gap-2 rounded-full px-3 text-[14px] font-medium transition-[color,background-color] duration-300 focus-visible:rounded-full! sm:h-12 sm:text-[15px] ${
                on ? "text-on-primary" : "text-ink hover:bg-card/70"
              }`}
            >
              <Glyph name={x.key as GlyphName} className="size-4" />
              <span className="truncate">{x.button}</span>
            </button>
          );
        })}
      </div>
    </Panel>
  );
}

/* ------------------------------------------------------- Price bars ---- */

export type Bar = { key: string; label: string; short: string; title: string; value?: number; text?: string; date?: string };

export type BarMode = {
  key: "12m" | "5y";
  button: string;
  bars: Bar[];
  big: string;
  bigLabel: string;
  change?: number;
  changeLabel: string;
  caption: string;
  gapNote?: string;
};

/** A run of bars: one bar with a price, or consecutive empty slots shown as one gap. */
type Slot = { gap: false; bar: Bar & { value: number }; index: number } | { gap: true; bars: Bar[] };

function slotsOf(bars: Bar[]): Slot[] {
  const out: Slot[] = [];
  bars.forEach((b, index) => {
    if (b.value !== undefined) out.push({ gap: false, bar: b as Bar & { value: number }, index });
    else {
      const last = out[out.length - 1];
      if (last?.gap) last.bars.push(b);
      else out.push({ gap: true, bars: [b] });
    }
  });
  return out;
}

const mouseOnly = (e: PointerEvent, fn: () => void) => {
  if (e.pointerType === "mouse") fn();
};

/**
 * "Earning Overview" card: soft grey bars with rounded tops that grow in,
 * the latest in the neon-blue highlight with a glowing value tag, and the
 * bar you point at (or tap) in a darker grey with a dark tooltip and a
 * crosshair line at its height. Dashed gridlines and a working
 * 12 months / 5 years switch. A run of months with no prices is drawn as
 * one striped gap, not a row of stubs.
 */
export function PriceBars({ modes, ticks }: { modes: BarMode[]; ticks: Record<BarMode["key"], number[]> }) {
  const [key, setKey] = useState<BarMode["key"]>("12m");
  const mode = modes.find((m) => m.key === key) ?? modes[0];
  const withData = mode.bars.filter((b) => b.value !== undefined);
  const latestBar = withData[withData.length - 1];
  const latest = latestBar?.key;
  const [pinned, setPinned] = useState<string | null>(null);
  const [hover, setHover] = useState<string | null>(null);
  const active = hover ?? pinned;
  const activeBar = mode.bars.find((x) => x.key === active);
  const readBar = activeBar ?? latestBar;
  const pinnedBar = mode.bars.find((x) => x.key === pinned);
  const axis = ticks[key];
  const top = axis[axis.length - 1];
  const h = (v: number) => (v / top) * 100;
  const keys = modes.map((m) => m.key);
  const slots = slotsOf(mode.bars);
  const n = mode.bars.length;
  const grow = (s: Slot) => (s.gap ? s.bars.length : 1);
  const pick = (k: BarMode["key"]) => {
    setKey(k);
    setPinned(null);
    setHover(null);
  };
  const crossAt = activeBar?.value ?? latestBar?.value;
  // Reading another bar than the latest: its crosshair is dashed ink; the latest's is solid blue.
  const reading = !!activeBar && activeBar.key !== latest;

  return (
    <Panel labelledBy="bars-title" className="flex flex-1 flex-col">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <PanelHead id="bars-title" icon="chart" title={`Price by ${key === "12m" ? "month" : "year"}`} />
        <div role="radiogroup" aria-label="Period" className="relative isolate grid grid-cols-2 rounded-full bg-inset p-1 shadow-[inset_0_1px_2px_rgb(15_23_42/0.06)]" onKeyDown={arrowKeys(keys, key, pick)}>
          <span
            className="absolute inset-y-1 left-1 -z-10 w-[calc(50%-4px)] translate-x-[calc(var(--i)*100%)] rounded-full bg-primary shadow-[0_4px_12px_-3px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.25)] transition-[translate] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)]"
            style={{ "--i": keys.indexOf(key) } as CSSProperties}
            aria-hidden="true"
          />
          {modes.map((m) => {
            const on = m.key === key;
            return (
              <button
                key={m.key}
                type="button"
                role="radio"
                aria-checked={on}
                tabIndex={on ? 0 : -1}
                onClick={() => pick(m.key)}
                className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors duration-300 focus-visible:rounded-full! ${on ? "text-on-primary" : "text-muted hover:text-ink"}`}
              >
                {m.button}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-6 flex flex-wrap items-center gap-x-3 gap-y-2">
        <p className="text-[34px] leading-none font-semibold tracking-[-0.035em] tabular-nums sm:text-[38px]">{mode.big}</p>
        <Chip value={mode.change} label={mode.changeLabel} />
      </div>
      <p className="mt-2 text-sm text-muted">{mode.bigLabel}</p>

      {/* plot: y axis labels + dashed gridlines, then the bars */}
      <div className="mt-10 flex flex-col min-[1360px]:flex-1">
        <div className="relative h-[240px] pl-8 sm:h-[280px] sm:pl-11 min-[1360px]:h-auto min-[1360px]:max-h-[400px] min-[1360px]:min-h-[260px] min-[1360px]:flex-1">
          {axis.map((t) => (
            <div key={t} className="absolute inset-x-0 flex translate-y-1/2 items-center" style={{ bottom: `${h(t)}%` }} aria-hidden="true">
              <span className="w-8 shrink-0 -translate-y-px pr-1.5 text-right text-[12px] text-faint tabular-nums sm:w-11 sm:pr-2.5">{t}</span>
              <span className={`flex-1 border-t border-dashed ${t === 0 ? "border-line" : "border-line/60"}`} />
            </div>
          ))}
          {/* crosshair at the height of the bar being read (the latest unless you point at one); above the bars and the gap stripes, below the tags */}
          {crossAt !== undefined && (
            <div
              className={`pointer-events-none absolute right-0 left-8 z-[1] transition-[bottom,border-color] duration-300 sm:left-11 ${reading ? "border-t-[1.5px] border-dashed" : "border-t border-solid"}`}
              style={{ bottom: `${h(crossAt)}%`, borderColor: reading ? "color-mix(in srgb, var(--color-ink) 40%, transparent)" : "color-mix(in srgb, var(--hl) 85%, transparent)" }}
              aria-hidden="true"
            />
          )}
          <ul key={key} role="list" className="absolute inset-y-0 right-0 left-8 flex gap-0 sm:left-11 sm:gap-2" aria-label={mode.caption}>
            {slots.map((s) => {
              if (s.gap) {
                const first = s.bars[0];
                const last = s.bars[s.bars.length - 1];
                const text = s.bars.length === 1 ? first.title : `${first.title} to ${last.title}`;
                return (
                  <li key={first.key} className="relative" style={{ flex: `${s.bars.length} 1 0%` }}>
                    <span className="sr-only">{text}: no prices on record</span>
                    <span
                      className="absolute inset-x-[3px] inset-y-0 flex animate-fade items-center justify-center rounded-[10px] bg-[repeating-linear-gradient(135deg,color-mix(in_srgb,var(--color-inset)_60%,transparent)_0_6px,transparent_6px_12px)] px-2 text-center text-[12px] leading-4 text-faint motion-reduce:animate-none sm:inset-x-0"
                      aria-hidden="true"
                    >
                      {s.bars.length >= 3 && <span className="relative z-[2] rounded-full bg-card px-3 py-1 shadow-(--cs)">No prices {text}</span>}
                    </span>
                  </li>
                );
              }
              const b = s.bar;
              const isLatest = b.key === latest;
              const isActive = b.key === active && !isLatest;
              const showTag = isLatest && (!active || active === latest);
              const edge = s.index <= 1 ? "left-0" : s.index >= n - 2 ? "right-0" : "left-1/2 -translate-x-1/2";
              const tip = s.index <= 1 ? "left-3" : s.index >= n - 2 ? "right-3" : "left-1/2 -translate-x-1/2";
              return (
                <li key={b.key} className="relative" style={{ flex: "1 1 0%" }}>
                  <button
                    type="button"
                    aria-pressed={pinned === b.key}
                    aria-label={`${b.title}: ${b.text}`}
                    onClick={() => {
                      setPinned(pinned === b.key ? null : b.key);
                      setHover(null);
                    }}
                    onPointerEnter={(e) => mouseOnly(e, () => setHover(b.key))}
                    onPointerLeave={(e) => mouseOnly(e, () => setHover(null))}
                    onFocus={() => setHover(b.key)}
                    onBlur={() => setHover(null)}
                    className="group absolute inset-0 cursor-pointer rounded-t-[12px] focus-visible:rounded-t-[12px]!"
                  >
                    <span
                      className={`absolute inset-x-[3px] bottom-0 origin-bottom animate-grow-y rounded-t-[12px] bg-linear-to-b transition-shadow duration-300 motion-reduce:animate-none sm:inset-x-0 ${
                        isLatest
                          ? "from-(--hl) via-(--hl)/60 to-(--hl)/10 shadow-[0_-4px_24px_-4px_var(--glow),inset_0_1px_0_rgb(255_255_255/0.45)]"
                          : isActive
                            ? "from-(--bar-hot) to-(--bar-hot)/15 shadow-[inset_0_1px_0_rgb(255_255_255/0.4)]"
                            : "from-(--bar-top) via-(--bar) to-(--bar)/0 shadow-[inset_0_1px_0_rgb(255_255_255/0.5)] group-hover:from-(--bar-hot)/70"
                      }`}
                      style={{ height: `${h(b.value)}%`, animationDelay: `${s.index * 45}ms` }}
                    />
                    {showTag && (
                      <span className={`absolute z-10 animate-pop motion-reduce:animate-none ${edge}`} style={{ bottom: `calc(${h(b.value)}% + 10px)`, animationDelay: `${n * 45 + 200}ms` }}>
                        <span className="block rounded-full bg-primary-solid px-2.5 py-1 text-[12px] font-semibold whitespace-nowrap text-on-primary-solid tabular-nums shadow-[0_6px_16px_-4px_var(--glow)] sm:text-[13px]">{b.text}</span>
                        <span className={`absolute -bottom-1 size-2.5 rotate-45 rounded-[2px] bg-primary-solid ${tip}`} aria-hidden="true" />
                      </span>
                    )}
                    {isActive && (
                      <span className={`absolute z-20 animate-pop motion-reduce:animate-none ${edge}`} style={{ bottom: `calc(${h(b.value)}% + 10px)` }}>
                        <span className="block rounded-[12px] bg-(--tip) px-3 py-2 text-left whitespace-nowrap shadow-[0_10px_24px_-6px_rgb(15_23_42/0.35)]">
                          <span className="block text-[12px] text-(--tip-mute)">{b.title}</span>
                          <span className="block text-[14px] font-semibold text-(--tip-ink) tabular-nums">{b.text}</span>
                        </span>
                        <span className={`absolute -bottom-1 size-2.5 rotate-45 rounded-[2px] bg-(--tip) ${tip}`} aria-hidden="true" />
                      </span>
                    )}
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
        <div className="mt-2.5 flex gap-0 pl-8 sm:gap-2 sm:pl-11" aria-hidden="true">
          {slots.map((s) =>
            s.gap ? (
              <span key={s.bars[0].key} className="text-center text-[12px] text-faint" style={{ flex: `${grow(s)} 1 0%` }}>
                {s.bars.length === 1 ? (
                  <>
                    <span className="sm:hidden">{s.bars[0].short}</span>
                    <span className="max-sm:hidden">{s.bars[0].label}</span>
                  </>
                ) : (
                  `${s.bars[0].label}–${s.bars[s.bars.length - 1].label}`
                )}
              </span>
            ) : (
              <span key={s.bar.key} className={`text-center text-[12px] transition-colors ${s.bar.key === (active ?? latest) ? "font-semibold text-ink" : "text-faint"}`} style={{ flex: "1 1 0%" }}>
                <span className="sm:hidden">{s.bar.short}</span>
                <span className="max-sm:hidden">{s.bar.label}</span>
              </span>
            ),
          )}
        </div>
      </div>

      <p className="mt-6 min-h-6 text-sm text-muted" aria-hidden="true">
        {readBar?.date && (
          <>
            <span className={`mr-2 inline-block size-2 rounded-full align-middle ${readBar.key === latest ? "bg-(--hl)" : "bg-ink/50"}`} />
            {readBar.title}: <span className="font-semibold text-ink tabular-nums">{readBar.text}</span> · last price on {readBar.date}
          </>
        )}
      </p>
      <p className="mt-2 text-sm leading-6 text-faint">
        {mode.caption}. Point at or tap a bar to read it.
        {mode.gapNote && <> {mode.gapNote}</>}
      </p>
      <span className="sr-only" aria-live="polite">
        {pinnedBar?.date ? `${pinnedBar.title}: ${pinnedBar.text}, last price on ${pinnedBar.date}` : ""}
      </span>
    </Panel>
  );
}

/* ---------------------------------------------- Where it stands rows ---- */

export type StandRow = { icon: GlyphName; label: string; pct: string; fill?: number; tick?: number; value: ReactNode; more: string };

/**
 * One row of the dark card: a frosted tile with icon, label and its values,
 * figure, a neon progress bar with a glowing end cap and a chevron. The row
 * is a button that opens the sentence behind the numbers with a smooth
 * height animation (the grid-rows trick); the chevron turns as it opens.
 * Narrow cards wrap the bar onto a second line.
 */
export function StandRowItem({ row, index }: { row: StandRow; index: number }) {
  const [open, setOpen] = useState(false);
  const id = useId();
  const fill = row.fill === undefined ? undefined : Math.min(1, Math.max(0, row.fill));
  const width = fill === undefined ? 0 : Math.max(fill * 100, 2);
  return (
    <div
      className={`rounded-[18px] ring-1 ring-white/[0.09] backdrop-blur-sm transition-colors duration-300 ring-inset in-data-[theme=dark]:ring-white/[0.1] ${
        open ? "bg-white/[0.075] in-data-[theme=dark]:bg-white/[0.09]" : "bg-white/[0.045] hover:bg-white/[0.065] in-data-[theme=dark]:bg-white/[0.06] in-data-[theme=dark]:hover:bg-white/[0.08]"
      }`}
    >
      <button
        type="button"
        aria-expanded={open}
        aria-controls={id}
        onClick={() => setOpen(!open)}
        className="group grid w-full cursor-pointer grid-cols-[2.25rem_minmax(0,1fr)_auto_1.75rem] items-center gap-x-3 gap-y-3 rounded-[18px] px-3.5 py-3 text-left focus-visible:rounded-[18px]! @xl:grid-cols-[2.25rem_11rem_4.25rem_minmax(3rem,1fr)_1.75rem]"
      >
        <span className="col-start-1 row-start-1 grid size-9 place-items-center rounded-full bg-white/[0.08] ring-1 ring-white/10 ring-inset" aria-hidden="true">
          <Glyph name={row.icon} className="size-[17px] text-(--dk-bar)" />
        </span>
        <span className="col-start-2 row-start-1 min-w-0">
          <span className="block text-[15px] leading-snug font-medium text-white">
            {row.label}
            <span className="sr-only">: </span>
          </span>
          <span className="block truncate text-[13px] leading-5 text-(--dk-mute) tabular-nums">
            {row.value}
            <span className="sr-only">, </span>
          </span>
        </span>
        <span className="col-start-3 row-start-1 text-right text-[15px] font-semibold whitespace-nowrap text-white tabular-nums">{row.pct}</span>
        {fill !== undefined && (
          <span className="relative col-span-2 col-start-2 row-start-2 h-2 rounded-full bg-(--dk-track) shadow-[inset_0_1px_1px_rgb(0_0_0/0.35)] @xl:col-span-1 @xl:col-start-4 @xl:row-start-1" aria-hidden="true">
            <span
              className="absolute inset-y-0 left-0 origin-left animate-grow-x rounded-full bg-linear-to-r from-(--dk-bar)/35 via-(--dk-bar)/75 to-(--dk-bar) motion-reduce:animate-none"
              style={{ width: `${width}%`, animationDelay: `${150 + index * 90}ms` }}
            />
            {/* glowing end cap at the bar's tip */}
            <span
              className="absolute top-1/2 size-3 -translate-x-1/2 -translate-y-1/2 animate-fade rounded-full bg-white shadow-(--cap-glow) ring-2 ring-(--dk-bar) motion-reduce:animate-none"
              style={{ left: `${width}%`, animationDelay: `${750 + index * 90}ms` }}
            />
            {row.tick !== undefined && <span className="absolute -top-1.5 -bottom-1.5 w-[3px] -translate-x-1/2 rounded-full bg-white/90" style={{ left: `${row.tick * 100}%` }} />}
          </span>
        )}
        <span className="col-start-4 row-start-1 grid size-7 place-items-center rounded-full bg-white/10 text-white transition-colors group-hover:bg-white/20 @xl:col-start-5" aria-hidden="true">
          <svg viewBox="0 0 16 16" className={`size-3.5 transition-transform duration-300 ${open ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M4 6l4 4 4-4" />
          </svg>
        </span>
      </button>
      <div id={id} className={`grid transition-[grid-template-rows] duration-300 ease-[cubic-bezier(0.2,0.7,0.2,1)] ${open ? "grid-rows-[1fr]" : "grid-rows-[0fr]"}`} inert={!open}>
        <div className="overflow-hidden">
          <p className={`px-4 pb-4 pl-[3.75rem] text-[14px] leading-6 text-(--dk-mute) transition-opacity duration-300 ${open ? "opacity-100" : "opacity-0"}`}>{row.more}</p>
        </div>
      </div>
    </div>
  );
}
