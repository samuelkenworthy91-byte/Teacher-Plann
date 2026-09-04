import type { ClassRow, PlanRow, SettingsRow, SlotRow } from "@/lib/types";
import { addDays, addSchoolDays, maxDate, minDate } from "@/lib/dates";
import {
  computeHandback,
  dailyRateFor,
  firstLessonOnOrAfter,
  generateSchedule,
  lastFeedbackDate,
  lessonsFor,
  type Suggestion,
} from "@/lib/engine";

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

/**
 * Arena scheduling rule layered over the offline engine: avoid overlap first,
 * but if the first clash-free slot would break the class's max-gap promise,
 * use the earliest legal lesson and deliberately accept an expected crossover.
 */
export function generateArenaSchedule(args: {
  classes: ClassRow[];
  slots: SlotRow[];
  plans: PlanRow[];
  settings: SettingsRow;
  today: string;
}): Suggestion[] {
  const base = generateSchedule(args);
  const classesById = new Map(args.classes.map((c) => [c.id, c]));

  return base.map((suggestion) => {
    if (!suggestion.late || suggestion.collectDate <= suggestion.dueBy) return suggestion;
    const cls = classesById.get(suggestion.classId);
    if (!cls) return suggestion;

    const last = lastFeedbackDate(cls.id, args.plans, classesById);
    const future = lessonsFor(cls.id, args.slots, addDays(last, 1), addDays(last, 120));
    const earliest =
      future[args.settings.minLessons - 1]?.date ??
      addDays(last, Math.max(2, args.settings.minLessons));
    const latestByLessons =
      future[args.settings.maxLessons - 1]?.date ??
      addDays(last, args.settings.maxGapDays);
    const latest = minDate(addDays(last, args.settings.maxGapDays), latestByLessons);
    const startFrom = maxDate(earliest, args.today);
    const legal = lessonsFor(cls.id, args.slots, startFrom, maxDate(latest, startFrom))[0];
    if (!legal || legal.date >= suggestion.collectDate) return suggestion;

    const hb = computeHandback(cls.id, args.slots, legal, args.settings.windowDays);
    return {
      ...suggestion,
      collectDate: legal.date,
      collectPeriod: legal.period,
      handbackDate: hb.date,
      handbackPeriod: hb.period,
      dailyRate: dailyRateFor(cls.studentCount, legal.date, hb.date),
      late: true,
      dueBy: latest,
    };
  });
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
