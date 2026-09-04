/**
 * Plain data types for MarkFlow's offline store.
 *
 * The app used to keep these rows in PostgreSQL; it now keeps them on the
 * device (localStorage inside the Android WebView), so the shapes below are
 * the single source of truth. They intentionally mirror the old SQL columns
 * so every screen and the scheduling engine keep working unchanged.
 */

export type ClassRow = {
  id: number;
  name: string;
  subject: string;
  yearGroup: string;
  studentCount: number;
  color: string;
  createdAt: string;
};

export type SlotRow = {
  id: number;
  classId: number;
  dayOfWeek: number; // 1 = Mon … 5 = Fri
  period: number; // 1..6
};

export type PlanStatus = "scheduled" | "marking" | "returned";
export type PlanType = "auto" | "manual";

export type PlanRow = {
  id: number;
  classId: number;
  title: string;
  planType: PlanType;
  status: PlanStatus;
  collectDate: string;
  collectPeriod: number | null;
  handbackDate: string;
  handbackPeriod: number | null;
  totalBooks: number;
  markedCount: number;
  dailyRate: number;
  locked: boolean;
  late: boolean;
  /** Number of deliberate "can't do it today" moves. */
  deferredCount: number;
  returnedAt: string | null;
  notes: string;
  createdAt: string;
};

export type EntryRow = {
  id: number;
  planId: number;
  date: string;
  count: number;
  createdAt: string;
};

export type SettingsRow = {
  /** Give feedback after at least this many lessons seen… */
  minLessons: number;
  /** …but never more than this many lessons without feedback. */
  maxLessons: number;
  /** Hard rule: never more than this many days without handing something back. */
  maxGapDays: number;
  /** School days kept between collecting books and handing them back. */
  windowDays: number;
};

export type Profile = {
  name: string;
};

/** Everything the app persists on the device. */
export type Database = {
  version: number;
  seq: number;
  profile: Profile;
  settings: SettingsRow;
  classes: ClassRow[];
  slots: SlotRow[];
  plans: PlanRow[];
  entries: EntryRow[];
  photo: string | null;
};

export const DEFAULT_SETTINGS: SettingsRow = {
  minLessons: 4,
  maxLessons: 8,
  maxGapDays: 14,
  windowDays: 5,
};
