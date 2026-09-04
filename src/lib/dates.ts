// All dates are plain "YYYY-MM-DD" strings. We do pure day arithmetic
// in UTC so server timezone can never cause off-by-one bugs.

export const DAY_MS = 86_400_000;

export function toDay(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

export function fmtDay(n: number): string {
  return new Date(n * DAY_MS).toISOString().slice(0, 10);
}

export function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(
    d.getDate(),
  ).padStart(2, "0")}`;
}

/** 0 = Sunday … 6 = Saturday */
export function weekday(s: string): number {
  return new Date(toDay(s) * DAY_MS).getUTCDay();
}

export const isWeekday = (s: string) => {
  const w = weekday(s);
  return w >= 1 && w <= 5;
};

export function addDays(s: string, n: number): string {
  return fmtDay(toDay(s) + n);
}

export function diffDays(a: string, b: string): number {
  return toDay(b) - toDay(a); // b - a in days
}

export const cmp = (a: string, b: string) => toDay(a) - toDay(b);
export const minDate = (a: string, b: string) => (cmp(a, b) <= 0 ? a : b);
export const maxDate = (a: string, b: string) => (cmp(a, b) >= 0 ? a : b);

/** Monday-first weekday labels. */
export const WEEKDAY_SHORT = ["Mon", "Tue", "Wed", "Thu", "Fri"];

const MONTHS = [
  "Jan", "Feb", "Mar", "Apr", "May", "Jun",
  "Jul", "Aug", "Sep", "Oct", "Nov", "Dec",
];
const DAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

/** "Fri 14 Jun" */
export function pretty(s: string): string {
  const d = new Date(toDay(s) * DAY_MS);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Fri 14" */
export function prettyShort(s: string): string {
  const d = new Date(toDay(s) * DAY_MS);
  return `${DAYS[d.getUTCDay()]} ${d.getUTCDate()} ${MONTHS[d.getUTCMonth()]}`;
}

/** "Friday 14 June" */
export function prettyLong(s: string): string {
  const d = new Date(toDay(s) * DAY_MS);
  const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
  const monthNames = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December",
  ];
  return `${dayNames[d.getUTCDay()]} ${d.getUTCDate()} ${monthNames[d.getUTCMonth()]}`;
}

/** Count of Mon–Fri days between a and b, both ends inclusive. Min 1. */
export function schoolDaysInclusive(a: string, b: string): number {
  if (cmp(a, b) > 0) return 1;
  let n = 0;
  for (let d = toDay(a); d <= toDay(b); d++) {
    const w = new Date(d * DAY_MS).getUTCDay();
    if (w >= 1 && w <= 5) n++;
  }
  return Math.max(1, n);
}

/** Move n school days (Mon–Fri). Negative n moves backwards. */
export function addSchoolDays(s: string, n: number): string {
  let d = toDay(s);
  let w = new Date(d * DAY_MS).getUTCDay();
  while (w === 0 || w === 6) {
    d += n < 0 ? -1 : 1;
    w = new Date(d * DAY_MS).getUTCDay();
  }
  let remaining = Math.abs(n);
  const step = n < 0 ? -1 : 1;
  while (remaining > 0) {
    d += step;
    w = new Date(d * DAY_MS).getUTCDay();
    if (w >= 1 && w <= 5) remaining--;
  }
  return fmtDay(d);
}

/** Monday of the week containing s. */
export function startOfWeek(s: string): string {
  const d = toDay(s);
  const w = new Date(d * DAY_MS).getUTCDay(); // 0 sun
  const back = w === 0 ? 6 : w - 1;
  return fmtDay(d - back);
}

export function clampInt(v: unknown, min: number, max: number, fallback: number): number {
  const n = typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
