import type { Frequency } from "./series";

/** How an indicator's values are written. Shared by server and client code. */
export type ValueFormat = "fx" | "aud-gram" | "pct1" | "pct2";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const MONTHS_LONG = [
  "January", "February", "March", "April", "May", "June",
  "July", "August", "September", "October", "November", "December",
];

function parts(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return { y, m, d };
}

export function formatValue(value: number, format: ValueFormat): string {
  return formatValueRaw(value, format).replace("-", "−");
}

function formatValueRaw(value: number, format: ValueFormat): string {
  switch (format) {
    case "fx":
      return value.toFixed(4);
    case "aud-gram":
      return `A$${value.toFixed(2)}`;
    case "pct1":
      return `${value.toFixed(1)}%`;
    case "pct2":
      return `${value.toFixed(2)}%`;
  }
}

/** Compact axis label, e.g. 0.65, 212, 4.5%. */
export function formatAxis(value: number, format: ValueFormat): string {
  switch (format) {
    case "fx":
      return value.toFixed(3);
    case "aud-gram":
      return `${Math.round(value)}`;
    case "pct1":
    case "pct2":
      return `${Number(value.toFixed(1))}%`;
  }
}

/** Signed change: "+0.2pp", "−1.35%". Uses a true minus sign. */
export function formatSigned(value: number, unit: "pp" | "%" | "bp", digits = 1): string {
  const rounded = Number(value.toFixed(digits));
  const sign = rounded > 0 ? "+" : rounded < 0 ? "−" : "";
  return `${sign}${Math.abs(rounded).toFixed(digits)}${unit}`;
}

export function formatUnsigned(value: number, unit: "pp" | "%" | "bp", digits = 1): string {
  return `${Math.abs(value).toFixed(digits)}${unit}`;
}

export const fmtDay = (iso: string) => {
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]} ${y}`;
};

export const fmtDayLong = (iso: string) => {
  const { y, m, d } = parts(iso);
  return `${d} ${MONTHS_LONG[m - 1]} ${y}`;
};

export const fmtDayShort = (iso: string) => {
  const { m, d } = parts(iso);
  return `${d} ${MONTHS[m - 1]}`;
};

export const fmtMonth = (iso: string) => {
  const { y, m } = parts(iso);
  return `${MONTHS[m - 1]} ${y}`;
};

export const fmtMonthLong = (iso: string) => {
  const { y, m } = parts(iso);
  return `${MONTHS_LONG[m - 1]} ${y}`;
};

/** Quarterly points are dated to the first day of the quarter's last month. */
export const fmtQuarter = (iso: string) => {
  const { y, m } = parts(iso);
  return `${MONTHS[m - 1]} qtr ${y}`;
};

export function fmtPeriod(iso: string, frequency: Frequency): string {
  switch (frequency) {
    case "daily":
    case "decisions":
      return fmtDay(iso);
    case "monthly":
      return fmtMonth(iso);
    case "quarterly":
      return fmtQuarter(iso);
  }
}

/** Shorter period label for tables and stat captions. */
export function fmtPeriodShort(iso: string, frequency: Frequency): string {
  return frequency === "quarterly" ? fmtMonth(iso) : fmtPeriod(iso, frequency);
}

export function fmtYear(iso: string): string {
  return iso.slice(0, 4);
}

export function fmtMoney(value: number, currency: "A$" | "US$", digits = 0): string {
  return `${currency}${value.toLocaleString("en-AU", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  })}`;
}

export function inDays(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "tomorrow";
  return `in ${days} days`;
}

/** How to show a value as a big number: decimals plus a unit before or after. */
export function valueParts(format: ValueFormat): { digits: number; prefix?: string; suffix?: string } {
  switch (format) {
    case "fx":
      return { digits: 4, prefix: "US$" };
    case "aud-gram":
      return { digits: 2, prefix: "A$" };
    case "pct1":
      return { digits: 1, suffix: "%" };
    case "pct2":
      return { digits: 2, suffix: "%" };
  }
}
