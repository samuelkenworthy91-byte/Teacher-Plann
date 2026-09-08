// All dates are plain "YYYY-MM-DD" strings. We do pure day arithmetic
// in UTC so server timezone can never cause off-by-one bugs.

export const DAY_MS = 86_400_000;

export function toDay(s: string): number {
  const [y, m, d] = s.split("-").map(Number);
  return Math.floor(Date.UTC(y, m - 1, d) / DAY_MS);
}

/** True only for a real ISO calendar day, not merely a date-shaped string. */
export function isValidDate(s: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(s)) return false;
  const [year, month, day] = s.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
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

export const NO_UNAVAILABLE_DATES: ReadonlySet<string> = new Set();

/** A weekday that has not been protected as a non-working/non-marking day. */
export function isAvailableSchoolDay(
  s: string,
  unavailableDates: ReadonlySet<string> = NO_UNAVAILABLE_DATES,
): boolean {
  return isWeekday(s) && !unavailableDates.has(s);
}

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
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
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
  const dayNames = [
    "Sunday",
    "Monday",
    "Tuesday",
    "Wednesday",
    "Thursday",
    "Friday",
    "Saturday",
  ];
  const monthNames = [
    "January",
    "February",
    "March",
    "April",
    "May",
    "June",
    "July",
    "August",
    "September",
    "October",
    "November",
    "December",
  ];
  return `${dayNames[d.getUTCDay()]} ${d.getUTCDate()} ${monthNames[d.getUTCMonth()]}`;
}

/**
 * Count available Mon–Fri marking days between a and b, both ends inclusive.
 * Protected dates do not consume a teacher's marking capacity. The minimum of
 * one keeps rate calculations safe for already-overdue dates.
 */
export function schoolDaysInclusive(
  a: string,
  b: string,
  unavailableDates: ReadonlySet<string> = NO_UNAVAILABLE_DATES,
): number {
  if (cmp(a, b) > 0) return 1;
  let n = 0;
  for (let d = toDay(a); d <= toDay(b); d++) {
    const current = fmtDay(d);
    if (isAvailableSchoolDay(current, unavailableDates)) n++;
  }
  return Math.max(1, n);
}

/**
 * Move n available school days. Weekends and protected non-working days are
 * skipped; negative n moves backwards. With n = 0 this returns the first
 * available school day on or after the supplied date.
 */
export function addSchoolDays(
  s: string,
  n: number,
  unavailableDates: ReadonlySet<string> = NO_UNAVAILABLE_DATES,
): string {
  let d = toDay(s);
  const step = n < 0 ? -1 : 1;
  while (!isAvailableSchoolDay(fmtDay(d), unavailableDates)) d += step;

  let remaining = Math.abs(n);
  while (remaining > 0) {
    d += step;
    if (isAvailableSchoolDay(fmtDay(d), unavailableDates)) remaining--;
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

export function clampInt(
  v: unknown,
  min: number,
  max: number,
  fallback: number,
): number {
  const n =
    typeof v === "string" ? parseInt(v, 10) : typeof v === "number" ? v : NaN;
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, Math.round(n)));
}
