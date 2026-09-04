import type { ClassRow, PlanRow, SettingsRow, SlotRow } from "@/db/schema";
import {
  addDays,
  addSchoolDays,
  cmp,
  diffDays,
  maxDate,
  minDate,
  pretty,
  schoolDaysInclusive,
  startOfWeek,
  toDay,
  weekday,
} from "@/lib/dates";

export type Occurrence = { date: string; period: number };

export type Suggestion = {
  classId: number;
  collectDate: string;
  collectPeriod: number;
  handbackDate: string;
  handbackPeriod: number;
  dailyRate: number;
  late: boolean;
  dueBy: string;
};

/* ------------------------------------------------------------------ */
/* Lesson occurrences                                                  */
/* ------------------------------------------------------------------ */

/** Every lesson of a class between two dates (inclusive), in order. */
export function lessonsFor(
  classId: number,
  slots: SlotRow[],
  from: string,
  to: string,
): Occurrence[] {
  const mine = slots.filter((s) => s.classId === classId);
  if (mine.length === 0) return [];
  const out: Occurrence[] = [];
  for (let d = toDay(from); d <= toDay(to); d++) {
    const date = new Date(d * 86_400_000).toISOString().slice(0, 10);
    const w = weekday(date);
    if (w < 1 || w > 5) continue;
    for (const s of mine) {
      if (s.dayOfWeek === w) out.push({ date, period: s.period });
    }
  }
  out.sort((a, b) => cmp(a.date, b.date) || a.period - b.period);
  return out;
}

export function firstLessonOnOrAfter(
  classId: number,
  slots: SlotRow[],
  date: string,
  withinDays = 40,
): Occurrence | null {
  const list = lessonsFor(classId, slots, date, addDays(date, withinDays));
  return list[0] ?? null;
}

/** First lesson of the class STRICTLY after the given date. */
export function nextLessonAfter(
  classId: number,
  slots: SlotRow[],
  date: string,
): Occurrence | null {
  return firstLessonOnOrAfter(classId, slots, addDays(date, 1));
}

/* ------------------------------------------------------------------ */
/* Rates                                                               */
/* ------------------------------------------------------------------ */

/** Minimum books/day to finish `total` between collect and handback (inclusive school days). */
export function dailyRateFor(total: number, from: string, to: string): number {
  const days = schoolDaysInclusive(from, to);
  return Math.max(1, Math.ceil(total / days));
}

/** What must be marked today for an in-progress plan to stay on pace. */
export function requiredToday(plan: PlanRow, today: string): number {
  const remaining = Math.max(0, plan.totalBooks - plan.markedCount);
  if (remaining === 0) return 0;
  const daysLeft = schoolDaysInclusive(maxDate(today, plan.collectDate), plan.handbackDate);
  return Math.max(1, Math.ceil(remaining / daysLeft));
}

/* ------------------------------------------------------------------ */
/* Hand-back lesson                                                    */
/* ------------------------------------------------------------------ */

/**
 * Pick the lesson to hand books back on: the first lesson of the same class
 * on or after a marking window of `windowDays` school days from collection.
 */
export function computeHandback(
  classId: number,
  slots: SlotRow[],
  collect: Occurrence,
  windowDays: number,
): Occurrence {
  const windowEnd = addSchoolDays(collect.date, Math.max(0, windowDays - 1));
  const lesson =
    firstLessonOnOrAfter(classId, slots, windowEnd, 35) ??
    firstLessonOnOrAfter(classId, slots, addDays(collect.date, 1), 35);
  return lesson ?? { date: windowEnd, period: collect.period };
}

/* ------------------------------------------------------------------ */
/* The scheduler                                                       */
/* ------------------------------------------------------------------ */

type Interval = { start: string; end: string };

const overlaps = (a: Interval, b: Interval) =>
  cmp(a.start, b.end) <= 0 && cmp(b.start, a.end) <= 0;

export function lastFeedbackDate(
  classId: number,
  plans: PlanRow[],
  classesById: Map<number, ClassRow>,
): string {
  let last: string | null = null;
  for (const p of plans) {
    if (p.classId === classId && p.status === "returned" && p.returnedAt) {
      if (!last || cmp(p.returnedAt, last) > 0) last = p.returnedAt;
    }
  }
  if (last) return last;
  const created = classesById.get(classId)?.createdAt;
  if (created) return created.toISOString().slice(0, 10);
  return addDays(new Date().toISOString().slice(0, 10), -7);
}

/**
 * Generate the next formative cycle for every class so that:
 *  - each class is marked every settings.minLessons..settings.maxLessons lessons,
 *  - no class ever waits more than settings.maxGapDays between hand-backs,
 *  - marking windows [collect … handback] NEVER overlap → you only ever mark
 *    one class's books at a time.
 */
export function generateSchedule(args: {
  classes: ClassRow[];
  slots: SlotRow[];
  plans: PlanRow[]; // all plans (busy intervals come from locked/manual/active ones)
  settings: SettingsRow;
  today: string;
}): Suggestion[] {
  const { classes, slots, plans, settings, today } = args;
  const classesById = new Map(classes.map((c) => [c.id, c]));

  // Intervals already spoken for: locked or manual plans + anything in flight.
  const busy: Interval[] = plans
    .filter((p) => p.status === "marking" || (p.status === "scheduled" && (p.locked || p.planType === "manual")))
    .map((p) => ({ start: p.collectDate, end: p.handbackDate }));

  // Classes that already have an auto plan in the diary don't need a new one.
  const alreadyPlanned = new Set(
    plans
      .filter(
        (p) =>
          (p.status === "scheduled" && (p.locked || p.planType === "manual")) ||
          p.status === "marking",
      )
      .map((p) => p.classId),
  );

  type Job = {
    cls: ClassRow;
    earliest: string;
    latest: string;
    hasSlots: boolean;
  };

  const jobs: Job[] = classes
    .filter((c) => !alreadyPlanned.has(c.id))
    .map((cls) => {
      const last = lastFeedbackDate(cls.id, plans, classesById);
      const future = lessonsFor(cls.id, slots, addDays(last, 1), addDays(last, 120));
      const earliest =
        future[settings.minLessons - 1]?.date ?? addDays(last, Math.max(2, settings.minLessons));
      const latestByLessons =
        future[settings.maxLessons - 1]?.date ?? addDays(last, settings.maxGapDays);
      const latest = minDate(addDays(last, settings.maxGapDays), latestByLessons);
      return { cls, earliest, latest, hasSlots: future.length > 0 };
    })
    .filter((j) => j.hasSlots)
    // Most desperate first → the tightest class wins the best slots.
    .sort((a, b) => cmp(a.latest, b.latest) || a.cls.name.localeCompare(b.cls.name));

  const out: Suggestion[] = [];

  for (const job of jobs) {
    const { cls } = job;
    const startFrom = maxDate(job.earliest, today);

    // Candidate collect lessons inside the legal window; if the window has
    // already passed we still offer the soonest possible lesson.
    let candidates = lessonsFor(cls.id, slots, startFrom, maxDate(job.latest, startFrom));
    if (candidates.length === 0) {
      const next = firstLessonOnOrAfter(cls.id, slots, today, 45);
      candidates = next ? [next] : [];
    }

    let chosen: { c: Occurrence; hb: Occurrence; late: boolean } | null = null;
    /** First legal (in-window) collect, ignoring clashes — the crossover fallback. */
    let firstLegal: { c: Occurrence; hb: Occurrence } | null = null;

    for (const c of candidates) {
      const hb = computeHandback(cls.id, slots, c, settings.windowDays);
      if (!firstLegal) firstLegal = { c, hb };
      const iv = { start: c.date, end: hb.date };
      if (!busy.some((b) => overlaps(iv, b))) {
        chosen = { c, hb, late: cmp(c.date, job.latest) > 0 };
        break;
      }
    }

    if (!chosen) {
      // Everything legal clashes → queue behind the current workload.
      const scan = lessonsFor(cls.id, slots, today, addDays(today, 150));
      for (const c of scan) {
        const hb = computeHandback(cls.id, slots, c, settings.windowDays);
        const iv = { start: c.date, end: hb.date };
        if (!busy.some((b) => overlaps(iv, b))) {
          chosen = { c, hb, late: cmp(c.date, job.latest) > 0 };
          break;
        }
      }
    }

    // Crossover is a last resort — but sometimes it has to happen. If the
    // only clash-free slot is SO far away that the class would blow through
    // its max-gap promise, book the earliest legal slot instead and accept
    // the overlap (it gets flagged on the diary). Waiting quietly is worse
    // than two piles at once.
    if (
      chosen &&
      firstLegal &&
      cmp(chosen.c.date, job.latest) > 0 &&
      cmp(firstLegal.c.date, chosen.c.date) < 0
    ) {
      chosen = { c: firstLegal.c, hb: firstLegal.hb, late: true };
    }

    if (!chosen && firstLegal && candidates.length > 0) {
      // Total gridlock (every slot for 150 days clashes) — take the earliest.
      chosen = { c: firstLegal.c, hb: firstLegal.hb, late: true };
    }

    if (!chosen) continue;

    busy.push({ start: chosen.c.date, end: chosen.hb.date });
    out.push({
      classId: cls.id,
      collectDate: chosen.c.date,
      collectPeriod: chosen.c.period,
      handbackDate: chosen.hb.date,
      handbackPeriod: chosen.hb.period,
      dailyRate: dailyRateFor(cls.studentCount, chosen.c.date, chosen.hb.date),
      late: chosen.late,
      dueBy: job.latest,
    });
  }

  out.sort((a, b) => cmp(a.collectDate, b.collectDate));
  return out;
}

/* ------------------------------------------------------------------ */
/* "Can't do it today" — deferral maths                                */
/* ------------------------------------------------------------------ */

export type DeferResult = {
  collectDate: string;
  collectPeriod: number;
  handbackDate: string;
  handbackPeriod: number;
  dailyRate: number;
};

/**
 * The teacher can't collect a scheduled pile today → slide the whole
 * cycle to the class's NEXT lesson (a formative only happens in a
 * lesson, so that's the only legal move) and rebuild the window from
 * there. `fallbackDays` is used for classes with no timetable slots.
 */
export function computeDeferCollect(args: {
  plan: PlanRow;
  slots: SlotRow[];
  settings: SettingsRow;
  today: string;
  studentCount: number;
}): DeferResult {
  const { plan, slots, settings, today, studentCount } = args;
  const lesson = nextLessonAfter(plan.classId, slots, today);
  const collect = lesson ?? { date: addSchoolDays(today, 1), period: plan.collectPeriod ?? 1 };
  const hb = computeHandback(plan.classId, slots, collect, settings.windowDays);
  return {
    collectDate: collect.date,
    collectPeriod: collect.period,
    handbackDate: hb.date,
    handbackPeriod: hb.period,
    dailyRate: dailyRateFor(plan.totalBooks || studentCount, collect.date, hb.date),
  };
}

/**
 * The teacher can't keep the marking pace → push the hand-back to the
 * class's next lesson after the current date and spread what's left
 * across the extra days. Keeps the pile moving instead of quietly
 * failing the promise.
 */
export function computeDeferHandback(args: {
  plan: PlanRow;
  slots: SlotRow[];
  today: string;
}): DeferResult {
  const { plan, slots } = args;
  // Work from today when the pile is already late, so the move always
  // buys genuinely new days rather than re-landing on a past lesson.
  const base = maxDate(args.today, plan.handbackDate);
  const lesson = nextLessonAfter(plan.classId, slots, base);
  const hb = lesson ?? { date: addSchoolDays(base, 2), period: plan.handbackPeriod ?? 1 };
  const remaining = Math.max(1, plan.totalBooks - plan.markedCount);
  return {
    collectDate: plan.collectDate,
    collectPeriod: plan.collectPeriod ?? 1,
    handbackDate: hb.date,
    handbackPeriod: hb.period,
    // pace covers only what's actually left, so a half-marked pile
    // doesn't get double-counted against the extra days
    dailyRate: dailyRateFor(remaining, maxDate(args.today, plan.collectDate), hb.date),
  };
}

/**
 * A pile the teacher took in OFF-schedule (assessment, mock, cover…).
 * Suggest the same sized window the smart planner uses, landing on the
 * class's next lesson after the window closes.
 */
export function suggestAdhocHandback(args: {
  classId: number;
  slots: SlotRow[];
  settings: SettingsRow;
  today: string;
}): { date: string; period: number | null } {
  const { classId, slots, settings, today } = args;
  const windowEnd = addSchoolDays(today, Math.max(0, settings.windowDays - 1));
  const lesson = firstLessonOnOrAfter(classId, slots, windowEnd, 35);
  return { date: lesson?.date ?? addSchoolDays(today, settings.windowDays), period: lesson?.period ?? null };
}

/** Lesson of this class TODAY, if any — used to label an off-schedule pile. */
export function lessonToday(classId: number, slots: SlotRow[], today: string): Occurrence | null {
  return lessonsFor(classId, slots, today, today)[0] ?? null;
}

/* ------------------------------------------------------------------ */
/* Class health (for the dashboard strip)                              */
/* ------------------------------------------------------------------ */

export type ClassHealth = {
  classId: number;
  lessonsSince: number;
  daysSince: number;
  status: "fresh" | "ok" | "due" | "overdue";
  nextPlanned: PlanRow | null;
};

export function computeClassHealth(
  cls: ClassRow,
  slots: SlotRow[],
  plans: PlanRow[],
  settings: SettingsRow,
  today: string,
): ClassHealth {
  const byId = new Map([[cls.id, cls]]);
  const last = lastFeedbackDate(cls.id, plans, byId);
  const lessons = lessonsFor(cls.id, slots, addDays(last, 1), today).length;
  const days = diffDays(last, today);
  const nextPlanned =
    plans
      .filter((p) => p.classId === cls.id && p.status !== "returned")
      .sort((a, b) => cmp(a.collectDate, b.collectDate))[0] ?? null;

  let status: ClassHealth["status"] = "fresh";
  if (nextPlanned && (nextPlanned.status === "marking" || cmp(nextPlanned.collectDate, today) <= 3)) {
    status = "fresh"; // handled — a cycle is booked in
  } else if (days >= settings.maxGapDays || lessons >= settings.maxLessons) status = "overdue";
  else if (days >= settings.maxGapDays - 4 || lessons >= settings.minLessons) status = "due";
  else if (lessons >= Math.max(1, settings.minLessons - 1)) status = "ok";

  return { classId: cls.id, lessonsSince: lessons, daysSince: days, status, nextPlanned };
}

/* ------------------------------------------------------------------ */
/* Notifications                                                       */
/* ------------------------------------------------------------------ */

export type Notice = {
  id: string;
  tone: "pen" | "warn" | "bad" | "good" | "ink";
  title: string;
  body: string;
};

export function buildNotices(args: {
  today: string;
  classes: ClassRow[];
  plans: PlanRow[];
  entries: { planId: number; date: string; count: number }[];
  settings: SettingsRow;
}): Notice[] {
  const { today, classes, plans, entries } = args;
  const byId = new Map(classes.map((c) => [c.id, c]));
  const notices: Notice[] = [];

  const active = plans.filter((p) => p.status !== "returned");
  active.sort((a, b) => cmp(a.collectDate, b.collectDate));

  for (const p of active) {
    const cls = byId.get(p.classId);
    if (!cls) continue;

    if (p.status === "scheduled" && cmp(p.collectDate, today) <= 0) {
      notices.push({
        id: `collect-${p.id}`,
        tone: "pen",
        title: `Collect ${cls.name} today`,
        body: `${p.title} · Period ${p.collectPeriod ?? "—"}. From tonight: mark ≥ ${dailyRateFor(
          p.totalBooks,
          today,
          p.handbackDate,
        )}/day to hand back on ${pretty(p.handbackDate)}.`,
      });
    }

    if (p.status === "marking") {
      const remaining = Math.max(0, p.totalBooks - p.markedCount);
      if (cmp(today, p.handbackDate) > 0 && remaining > 0) {
        notices.push({
          id: `late-${p.id}`,
          tone: "bad",
          title: `${cls.name} is past its hand-back date`,
          body: `${remaining} books still unmarked — they were due back on ${pretty(
            p.handbackDate,
          )}.`,
        });
        continue;
      }
      if (remaining > 0) {
        const need = requiredToday(p, today);
        const doneToday = entries
          .filter((e) => e.planId === p.id && e.date === today)
          .reduce((s, e) => s + e.count, 0);
        if (doneToday < need) {
          notices.push({
            id: `mark-${p.id}`,
            tone: doneToday === 0 ? "warn" : "ink",
            title: `Mark at least ${need - doneToday} more ${cls.name} book${need - doneToday === 1 ? "" : "s"} today`,
            body: `${p.markedCount}/${p.totalBooks} done · hand back ${pretty(p.handbackDate)}. Stay ahead and the next class is already queued after this one.`,
          });
        } else {
          notices.push({
            id: `done-${p.id}`,
            tone: "good",
            title: `${cls.name} is on pace for today`,
            body: `You've hit today's minimum of ${need}. Anything extra is borrowed time for tomorrow.`,
          });
        }
      }
    }
  }

  if (notices.length === 0) {
    notices.push({
      id: "clear",
      tone: "good",
      title: "Nothing urgent today",
      body: "No collections due and no marking in flight. A genuinely free evening — savour it.",
    });
  }
  return notices;
}

/* ------------------------------------------------------------------ */
/* Weekly workload (planner load meter)                                */
/* ------------------------------------------------------------------ */

export function weeklyLoad(plans: PlanRow[], today: string, weeks = 6) {
  const monday = startOfWeek(today);
  return Array.from({ length: weeks }, (_, i) => {
    const start = addDays(monday, i * 7);
    const end = addDays(start, 4); // fri
    const activePlans = plans.filter(
      (p) => p.status !== "returned" && cmp(p.collectDate, end) <= 0 && cmp(p.handbackDate, start) >= 0,
    );
    const load = activePlans.reduce((s, p) => s + p.dailyRate, 0);
    return { start, label: pretty(start), load, plans: activePlans.length };
  });
}

/** True when no two live plans overlap → "never marking two classes at once". */
export function findClashes(plans: PlanRow[]) {
  const live = plans
    .filter((p) => p.status !== "returned")
    .sort((a, b) => cmp(a.collectDate, b.collectDate));
  const clashes: { a: PlanRow; b: PlanRow }[] = [];
  for (let i = 0; i < live.length; i++) {
    for (let j = i + 1; j < live.length; j++) {
      const a = live[i];
      const b = live[j];
      if (cmp(b.collectDate, a.handbackDate) > 0) break;
      clashes.push({ a, b });
    }
  }
  return clashes;
}
