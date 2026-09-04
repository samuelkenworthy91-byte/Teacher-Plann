"use client";

import { mutate, getDb, nextId } from "@/lib/store";
import { todayStr, clampInt } from "@/lib/dates";
import { dailyRateFor } from "@/lib/engine";
import {
  computeDeferCollect,
  computeDeferHandback,
  generateArenaSchedule,
  lessonToday,
  suggestAdhocHandback,
} from "@/lib/arena-offline";
import type { ActionResult } from "@/actions/classes";
import type { PlanRow } from "@/lib/types";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

function findPlan(id: number): PlanRow | null {
  return getDb().plans.find((p) => p.id === id) ?? null;
}

function newPlan(id: number, input: Partial<PlanRow> & { classId: number }): PlanRow {
  return {
    id,
    classId: input.classId,
    title: input.title ?? "Formative check",
    planType: input.planType ?? "auto",
    status: input.status ?? "scheduled",
    collectDate: input.collectDate ?? todayStr(),
    collectPeriod: input.collectPeriod ?? null,
    handbackDate: input.handbackDate ?? todayStr(),
    handbackPeriod: input.handbackPeriod ?? null,
    totalBooks: input.totalBooks ?? 30,
    markedCount: input.markedCount ?? 0,
    dailyRate: input.dailyRate ?? 6,
    locked: input.locked ?? false,
    late: input.late ?? false,
    deferredCount: input.deferredCount ?? 0,
    returnedAt: input.returnedAt ?? null,
    notes: input.notes ?? "",
    createdAt: input.createdAt ?? todayStr(),
  };
}

/* ------------------------------------------------------------------ */
/* Smart planner                                                       */
/* ------------------------------------------------------------------ */

/** Rebuild only flexible future auto plans around locked/manual/active piles. */
async function restaggerDiary(): Promise<number> {
  const db = getDb();
  if (db.classes.length === 0 || db.slots.length === 0) return 0;

  const today = todayStr();
  const suggestions = generateArenaSchedule({
    classes: db.classes,
    slots: db.slots,
    plans: db.plans,
    settings: db.settings,
    today,
  });

  mutate((draft) => {
    draft.plans = draft.plans.filter(
      (p) => !(p.status === "scheduled" && p.planType === "auto" && !p.locked),
    );
    const classById = new Map(draft.classes.map((c) => [c.id, c]));
    for (const s of suggestions) {
      draft.plans.push(
        newPlan(nextId(draft), {
          classId: s.classId,
          title: "Formative check",
          planType: "auto",
          status: "scheduled",
          collectDate: s.collectDate,
          collectPeriod: s.collectPeriod,
          handbackDate: s.handbackDate,
          handbackPeriod: s.handbackPeriod,
          totalBooks: classById.get(s.classId)?.studentCount ?? 30,
          dailyRate: s.dailyRate,
          late: s.late,
        }),
      );
    }
  });

  return suggestions.length;
}

export async function generatePlanAction(): Promise<ActionResult & { count?: number }> {
  const db = getDb();
  if (db.classes.length === 0) return { ok: false, error: "Add a class first." };
  if (db.slots.length === 0) return { ok: false, error: "Fill in your timetable first." };
  const count = await restaggerDiary();
  return { ok: true, count };
}

/* ------------------------------------------------------------------ */
/* Arena: "Can't do it today"                                          */
/* ------------------------------------------------------------------ */

export async function deferCollectAction(
  id: number,
): Promise<ActionResult & { collectDate?: string; handbackDate?: string }> {
  const db = getDb();
  const plan = db.plans.find((p) => p.id === id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "scheduled") {
    return { ok: false, error: "Already collected — push the hand-back instead." };
  }

  const today = todayStr();
  const cls = db.classes.find((c) => c.id === plan.classId);
  const next = computeDeferCollect({
    plan,
    slots: db.slots,
    settings: db.settings,
    today,
    studentCount: cls?.studentCount ?? plan.totalBooks,
  });

  mutate((draft) => {
    draft.plans = draft.plans.map((p) =>
      p.id === id
        ? {
            ...p,
            collectDate: next.collectDate,
            collectPeriod: next.collectPeriod,
            handbackDate: next.handbackDate,
            handbackPeriod: next.handbackPeriod,
            dailyRate: next.dailyRate,
            locked: true,
            deferredCount: p.deferredCount + 1,
          }
        : p,
    );
  });
  await restaggerDiary();
  return { ok: true, collectDate: next.collectDate, handbackDate: next.handbackDate };
}

export async function deferHandbackAction(
  id: number,
): Promise<ActionResult & { handbackDate?: string; dailyRate?: number }> {
  const db = getDb();
  const plan = db.plans.find((p) => p.id === id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status === "returned") return { ok: false, error: "Already handed back." };

  const next = computeDeferHandback({ plan, slots: db.slots, today: todayStr() });
  mutate((draft) => {
    draft.plans = draft.plans.map((p) =>
      p.id === id
        ? {
            ...p,
            handbackDate: next.handbackDate,
            handbackPeriod: next.handbackPeriod,
            dailyRate: next.dailyRate,
            late: true,
            locked: true,
            deferredCount: p.deferredCount + 1,
          }
        : p,
    );
  });
  await restaggerDiary();
  return { ok: true, handbackDate: next.handbackDate, dailyRate: next.dailyRate };
}

/* ------------------------------------------------------------------ */
/* Arena: "I've taken something in"                                    */
/* ------------------------------------------------------------------ */

export async function createAdhocAction(
  formData: FormData,
): Promise<ActionResult & { handbackDate?: string }> {
  const db = getDb();
  const classId = Number(formData.get("classId"));
  const title = String(formData.get("title") ?? "").trim() || "Taken in today";
  const totalOverride = clampInt(formData.get("totalBooks"), 1, 400, 0);
  const requestedHandback = String(formData.get("handbackDate") ?? "");

  const cls = db.classes.find((c) => c.id === classId);
  if (!cls) return { ok: false, error: "Pick a class." };

  const today = todayStr();
  const total = totalOverride > 0 ? totalOverride : cls.studentCount;
  const suggested = suggestAdhocHandback({
    classId,
    slots: db.slots,
    settings: db.settings,
    today,
  });
  const handbackDate =
    DATE_RE.test(requestedHandback) && requestedHandback >= today
      ? requestedHandback
      : suggested.date;
  const todayLesson = lessonToday(classId, db.slots, today);

  mutate((draft) => {
    const id = nextId(draft);
    draft.plans.unshift(
      newPlan(id, {
        classId,
        title,
        planType: "manual",
        status: "marking",
        collectDate: today,
        collectPeriod: todayLesson?.period ?? null,
        handbackDate,
        handbackPeriod: suggested.period ?? todayLesson?.period ?? null,
        totalBooks: total,
        dailyRate: dailyRateFor(total, today, handbackDate),
        locked: true,
      }),
    );
  });

  await restaggerDiary();
  return { ok: true, handbackDate };
}

/* ------------------------------------------------------------------ */
/* Manual deadline task                                                */
/* ------------------------------------------------------------------ */

export async function createTaskAction(formData: FormData): Promise<ActionResult> {
  const db = getDb();
  const classId = Number(formData.get("classId"));
  const title = String(formData.get("title") ?? "").trim() || "Marking task";
  const deadline = String(formData.get("deadline") ?? "");
  const totalOverride = clampInt(formData.get("totalBooks"), 1, 400, 0);

  const cls = db.classes.find((c) => c.id === classId);
  if (!cls) return { ok: false, error: "Pick a class." };
  if (!DATE_RE.test(deadline)) return { ok: false, error: "Pick a deadline date." };

  const today = todayStr();
  const total = totalOverride > 0 ? totalOverride : cls.studentCount;
  const handback = deadline < today ? today : deadline;

  let id = 0;
  mutate((draft) => {
    id = nextId(draft);
    draft.plans.unshift(
      newPlan(id, {
        classId,
        title,
        planType: "manual",
        status: "marking",
        collectDate: today,
        handbackDate: handback,
        totalBooks: total,
        dailyRate: dailyRateFor(total, today, handback),
        locked: true,
      }),
    );
  });
  await restaggerDiary();
  return { ok: true, id };
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

function patchPlan(id: number, patch: Partial<PlanRow>) {
  mutate((draft) => {
    draft.plans = draft.plans.map((p) => (p.id === id ? { ...p, ...patch } : p));
  });
}

export async function collectPlanAction(id: number): Promise<ActionResult> {
  const plan = findPlan(id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "scheduled") return { ok: false, error: "Already collected." };

  const today = todayStr();
  const handback = plan.handbackDate < today ? today : plan.handbackDate;
  patchPlan(id, {
    status: "marking",
    collectDate: today,
    handbackDate: handback,
    dailyRate: dailyRateFor(plan.totalBooks, today, handback),
    locked: true,
  });
  return { ok: true };
}

export async function logBooksAction(id: number, delta: number): Promise<ActionResult> {
  const plan = findPlan(id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "marking") return { ok: false, error: "Collect the books first." };

  const next = Math.max(0, Math.min(plan.totalBooks, plan.markedCount + Math.round(delta)));
  const actualDelta = next - plan.markedCount;
  if (actualDelta === 0) return { ok: true };

  const today = todayStr();
  mutate((draft) => {
    draft.entries.unshift({
      id: nextId(draft),
      planId: id,
      date: today,
      count: actualDelta,
      createdAt: new Date().toISOString(),
    });
    draft.plans = draft.plans.map((p) => (p.id === id ? { ...p, markedCount: next } : p));
  });
  return { ok: true };
}

export async function returnPlanAction(id: number): Promise<ActionResult> {
  if (!findPlan(id)) return { ok: false, error: "Plan not found." };
  patchPlan(id, { status: "returned", returnedAt: todayStr(), locked: true });
  return { ok: true };
}

export async function reopenPlanAction(id: number): Promise<ActionResult> {
  if (!findPlan(id)) return { ok: false, error: "Plan not found." };
  patchPlan(id, { status: "marking", returnedAt: null });
  return { ok: true };
}

export async function deletePlanAction(id: number): Promise<ActionResult> {
  mutate((draft) => {
    draft.plans = draft.plans.filter((p) => p.id !== id);
    draft.entries = draft.entries.filter((e) => e.planId !== id);
  });
  await restaggerDiary();
  return { ok: true };
}

export async function toggleLockAction(id: number): Promise<ActionResult> {
  const plan = findPlan(id);
  if (!plan) return { ok: false, error: "Plan not found." };
  patchPlan(id, { locked: !plan.locked });
  return { ok: true };
}

export async function updatePlanAction(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const plan = findPlan(id);
  if (!plan) return { ok: false, error: "Plan not found." };

  const title = String(formData.get("title") ?? "").trim() || plan.title;
  const collectDate = String(formData.get("collectDate") ?? plan.collectDate);
  const handbackDate = String(formData.get("handbackDate") ?? plan.handbackDate);
  const totalBooks = clampInt(formData.get("totalBooks"), 1, 400, plan.totalBooks);

  if (!DATE_RE.test(collectDate) || !DATE_RE.test(handbackDate)) {
    return { ok: false, error: "Dates need to be real dates." };
  }
  if (handbackDate < collectDate) {
    return { ok: false, error: "Hand-back must be after collection." };
  }

  patchPlan(id, {
    title,
    collectDate,
    handbackDate,
    totalBooks,
    markedCount: Math.min(plan.markedCount, totalBooks),
    dailyRate: dailyRateFor(totalBooks, collectDate, handbackDate),
    locked: true,
  });
  await restaggerDiary();
  return { ok: true };
}
