import type { PlanRow, SettingsRow, SlotRow } from "@/lib/types";
import { addDays, addSchoolDays, maxDate } from "@/lib/dates";
import { computeHandback, dailyRateFor, firstLessonOnOrAfter, lessonsFor } from "@/lib/engine";

export type DeferResult = {
  collectDate: string;
  collectPeriod: number;
  handbackDate: string;
  handbackPeriod: number;
  dailyRate: number;
};

/** First lesson of a class strictly after a date. */
export function nextLessonAfter(
  classId: number,
  slots: SlotRow[],
  date: string,
): { date: string; period: number } | null {
  return firstLessonOnOrAfter(classId, slots, addDays(date, 1));
}

/** Move a scheduled collection to the class's next lesson and rebuild its window. */
export function computeDeferCollect(args: {
  plan: PlanRow;
  slots: SlotRow[];
  settings: SettingsRow;
  today: string;
  studentCount: number;
}): DeferResult {
  const { plan, slots, settings, today, studentCount } = args;
  const lesson = nextLessonAfter(plan.classId, slots, today);
  const collect = lesson ?? {
    date: addSchoolDays(today, 1),
    period: plan.collectPeriod ?? 1,
  };
  const hb = computeHandback(plan.classId, slots, collect, settings.windowDays);
  return {
    collectDate: collect.date,
    collectPeriod: collect.period,
    handbackDate: hb.date,
    handbackPeriod: hb.period,
    dailyRate: dailyRateFor(plan.totalBooks || studentCount, collect.date, hb.date),
  };
}

/** Push an active hand-back to the next lesson and recalculate pace from books left. */
export function computeDeferHandback(args: {
  plan: PlanRow;
  slots: SlotRow[];
  today: string;
}): DeferResult {
  const { plan, slots, today } = args;
  const base = maxDate(today, plan.handbackDate);
  const lesson = nextLessonAfter(plan.classId, slots, base);
  const hb = lesson ?? {
    date: addSchoolDays(base, 2),
    period: plan.handbackPeriod ?? 1,
  };
  const remaining = Math.max(1, plan.totalBooks - plan.markedCount);
  return {
    collectDate: plan.collectDate,
    collectPeriod: plan.collectPeriod ?? 1,
    handbackDate: hb.date,
    handbackPeriod: hb.period,
    dailyRate: dailyRateFor(remaining, maxDate(today, plan.collectDate), hb.date),
  };
}

/** Suggest a normal marking window for an unplanned pile taken in today. */
export function suggestAdhocHandback(args: {
  classId: number;
  slots: SlotRow[];
  settings: SettingsRow;
  today: string;
}): { date: string; period: number | null } {
  const { classId, slots, settings, today } = args;
  const windowEnd = addSchoolDays(today, Math.max(0, settings.windowDays - 1));
  const lesson = firstLessonOnOrAfter(classId, slots, windowEnd, 35);
  return {
    date: lesson?.date ?? addSchoolDays(today, settings.windowDays),
    period: lesson?.period ?? null,
  };
}

/** Lesson of this class today, if one exists. */
export function lessonToday(
  classId: number,
  slots: SlotRow[],
  today: string,
): { date: string; period: number } | null {
  return lessonsFor(classId, slots, today, today)[0] ?? null;
}
