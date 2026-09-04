"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, markingEntries, markingPlans, timetableSlots } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { todayStr, clampInt } from "@/lib/dates";
import {
  computeDeferCollect,
  computeDeferHandback,
  dailyRateFor,
  generateSchedule,
  lessonToday,
  suggestAdhocHandback,
} from "@/lib/engine";
import { getSettings } from "@/lib/queries";
import { and, eq } from "drizzle-orm";
import type { ActionResult } from "@/actions/classes";

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

async function ownPlan(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(markingPlans)
    .where(and(eq(markingPlans.id, id), eq(markingPlans.userId, userId)))
    .limit(1);
  return row ?? null;
}

/* ------------------------------------------------------------------ */
/* Smart planner                                                       */
/* ------------------------------------------------------------------ */

/**
 * Re-run the scheduler for everything that is still flexible
 * (unlocked, auto, not yet collected). Locked plans, manual piles and
 * anything already on the desk stay exactly where they are — the rest
 * of the diary reshuffles around them, crossing over only when the
 * alternative is breaking the max-gap promise.
 */
async function restaggerDiary(userId: number): Promise<number> {
  const today = todayStr();
  const [cls, slotRows, freshPlans, settings] = await Promise.all([
    db.select().from(classes).where(eq(classes.userId, userId)),
    db.select().from(timetableSlots).where(eq(timetableSlots.userId, userId)),
    db.select().from(markingPlans).where(eq(markingPlans.userId, userId)),
    getSettings(userId),
  ]);
  if (cls.length === 0 || slotRows.length === 0) return 0;

  const suggestions = generateSchedule({
    classes: cls,
    slots: slotRows,
    plans: freshPlans,
    settings,
    today,
  });

  await db
    .delete(markingPlans)
    .where(
      and(
        eq(markingPlans.userId, userId),
        eq(markingPlans.status, "scheduled"),
        eq(markingPlans.planType, "auto"),
        eq(markingPlans.locked, false),
      ),
    );

  const classById = new Map(cls.map((c) => [c.id, c]));
  if (suggestions.length > 0) {
    await db.insert(markingPlans).values(
      suggestions.map((s) => ({
        userId,
        classId: s.classId,
        title: "Formative check",
        planType: "auto" as const,
        status: "scheduled" as const,
        collectDate: s.collectDate,
        collectPeriod: s.collectPeriod,
        handbackDate: s.handbackDate,
        handbackPeriod: s.handbackPeriod,
        totalBooks: classById.get(s.classId)?.studentCount ?? 30,
        dailyRate: s.dailyRate,
        late: s.late,
      })),
    );
  }
  return suggestions.length;
}

export async function generatePlanAction(): Promise<ActionResult & { count?: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const [clsCount, slotCount] = await Promise.all([
    db.select({ id: classes.id }).from(classes).where(eq(classes.userId, user.id)).limit(1),
    db.select({ id: timetableSlots.id }).from(timetableSlots).where(eq(timetableSlots.userId, user.id)).limit(1),
  ]);
  if (clsCount.length === 0) return { ok: false, error: "Add a class first." };
  if (slotCount.length === 0) return { ok: false, error: "Fill in your timetable first." };

  const count = await restaggerDiary(user.id);
  revalidatePath("/", "layout");
  return { ok: true, count };
}

/* ------------------------------------------------------------------ */
/* "Can't do it today" — defer a collection                            */
/* ------------------------------------------------------------------ */

export async function deferCollectAction(
  id: number,
): Promise<ActionResult & { collectDate?: string; handbackDate?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "scheduled")
    return { ok: false, error: "Already collected — push the hand-back instead." };

  const today = todayStr();
  const [slotRows, settings] = await Promise.all([
    db.select().from(timetableSlots).where(eq(timetableSlots.userId, user.id)),
    getSettings(user.id),
  ]);
  const next = computeDeferCollect({ plan, slots: slotRows, settings, today, studentCount: 30 });

  await db
    .update(markingPlans)
    .set({
      collectDate: next.collectDate,
      collectPeriod: next.collectPeriod,
      handbackDate: next.handbackDate,
      handbackPeriod: next.handbackPeriod,
      dailyRate: next.dailyRate,
      locked: true, // you moved it on purpose — regeneration must respect that
      deferredCount: plan.deferredCount + 1,
    })
    .where(eq(markingPlans.id, id));

  // Everything still flexible reshuffles around the new dates.
  await restaggerDiary(user.id);
  revalidatePath("/", "layout");
  return { ok: true, collectDate: next.collectDate, handbackDate: next.handbackDate };
}

/* ------------------------------------------------------------------ */
/* "Can't keep the pace" — push a hand-back                            */
/* ------------------------------------------------------------------ */

export async function deferHandbackAction(
  id: number,
): Promise<ActionResult & { handbackDate?: string; dailyRate?: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status === "returned") return { ok: false, error: "Already handed back." };

  const today = todayStr();
  const [slotRows] = await Promise.all([
    db.select().from(timetableSlots).where(eq(timetableSlots.userId, user.id)),
  ]);
  const next = computeDeferHandback({ plan, slots: slotRows, today });

  await db
    .update(markingPlans)
    .set({
      handbackDate: next.handbackDate,
      handbackPeriod: next.handbackPeriod,
      dailyRate: next.dailyRate,
      late: true, // it now sits outside the ideal window
      locked: true,
      deferredCount: plan.deferredCount + 1,
    })
    .where(eq(markingPlans.id, id));

  await restaggerDiary(user.id);
  revalidatePath("/", "layout");
  return { ok: true, handbackDate: next.handbackDate, dailyRate: next.dailyRate };
}

/* ------------------------------------------------------------------ */
/* "I've taken something in" — off-schedule pile (assessment, mock…)   */
/* ------------------------------------------------------------------ */

export async function createAdhocAction(
  formData: FormData,
): Promise<ActionResult & { handbackDate?: string }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const classId = Number(formData.get("classId"));
  const title = String(formData.get("title") ?? "").trim() || "Taken in today";
  const totalOverride = clampInt(formData.get("totalBooks"), 1, 400, 0);
  const handback = String(formData.get("handbackDate") ?? "");

  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.userId, user.id)))
    .limit(1);
  if (!cls) return { ok: false, error: "Pick a class." };

  const today = todayStr();
  const [slotRows, settings] = await Promise.all([
    db.select().from(timetableSlots).where(eq(timetableSlots.userId, user.id)),
    getSettings(user.id),
  ]);

  const total = totalOverride > 0 ? totalOverride : cls.studentCount;
  const suggested = suggestAdhocHandback({ classId, slots: slotRows, settings, today });
  const handbackDate = DATE_RE.test(handback) && handback >= today ? handback : suggested.date;

  const todayLesson = lessonToday(classId, slotRows, today);

  await db.insert(markingPlans).values({
    userId: user.id,
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
  });

  // Re-stagger the flexible part of the diary so nothing else lands on
  // this pile unless the max-gap rule forces a crossover.
  await restaggerDiary(user.id);
  revalidatePath("/", "layout");
  return { ok: true, handbackDate };
}

/* ------------------------------------------------------------------ */
/* Manual deadline task                                                */
/* ------------------------------------------------------------------ */

export async function createTaskAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const classId = Number(formData.get("classId"));
  const title = String(formData.get("title") ?? "").trim() || "Marking task";
  const deadline = String(formData.get("deadline") ?? "");
  const totalOverride = clampInt(formData.get("totalBooks"), 1, 400, 0);

  const [cls] = await db
    .select()
    .from(classes)
    .where(and(eq(classes.id, classId), eq(classes.userId, user.id)))
    .limit(1);
  if (!cls) return { ok: false, error: "Pick a class." };
  if (!DATE_RE.test(deadline)) return { ok: false, error: "Pick a deadline date." };

  const today = todayStr();
  const total = totalOverride > 0 ? totalOverride : cls.studentCount;
  const collect = today;

  const [row] = await db
    .insert(markingPlans)
    .values({
      userId: user.id,
      classId,
      title,
      planType: "manual",
      status: "marking",
      collectDate: collect,
      handbackDate: deadline < today ? today : deadline,
      totalBooks: total,
      dailyRate: dailyRateFor(total, collect, deadline < today ? today : deadline),
      locked: true,
    })
    .returning();
  revalidatePath("/", "layout");
  return { ok: true, id: row.id };
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

export async function collectPlanAction(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "scheduled") return { ok: false, error: "Already collected." };

  const today = todayStr();
  const handback = plan.handbackDate < today ? today : plan.handbackDate;
  await db
    .update(markingPlans)
    .set({
      status: "marking",
      collectDate: today,
      handbackDate: handback,
      dailyRate: dailyRateFor(plan.totalBooks, today, handback),
      locked: true,
    })
    .where(eq(markingPlans.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function logBooksAction(id: number, delta: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "marking") return { ok: false, error: "Collect the books first." };

  const next = Math.max(0, Math.min(plan.totalBooks, plan.markedCount + Math.round(delta)));
  const actualDelta = next - plan.markedCount;
  const today = todayStr();
  if (actualDelta !== 0) {
    await db.insert(markingEntries).values({ planId: id, userId: user.id, date: today, count: actualDelta });
    await db.update(markingPlans).set({ markedCount: next }).where(eq(markingPlans.id, id));
  }
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function returnPlanAction(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };

  await db
    .update(markingPlans)
    .set({ status: "returned", returnedAt: todayStr(), locked: true })
    .where(eq(markingPlans.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function reopenPlanAction(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };

  await db
    .update(markingPlans)
    .set({ status: "marking", returnedAt: null })
    .where(eq(markingPlans.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function deletePlanAction(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  await db
    .delete(markingPlans)
    .where(and(eq(markingPlans.id, id), eq(markingPlans.userId, user.id)));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function toggleLockAction(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };
  await db.update(markingPlans).set({ locked: !plan.locked }).where(eq(markingPlans.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function updatePlanAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const id = Number(formData.get("id"));
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };

  const title = String(formData.get("title") ?? "").trim() || plan.title;
  const collectDate = String(formData.get("collectDate") ?? plan.collectDate);
  const handbackDate = String(formData.get("handbackDate") ?? plan.handbackDate);
  const totalBooks = clampInt(formData.get("totalBooks"), 1, 400, plan.totalBooks);

  if (!DATE_RE.test(collectDate) || !DATE_RE.test(handbackDate)) {
    return { ok: false, error: "Dates need to be real dates." };
  }
  if (handbackDate < collectDate) return { ok: false, error: "Hand-back must be after collection." };

  const markedCount = Math.min(plan.markedCount, totalBooks);
  await db
    .update(markingPlans)
    .set({
      title,
      collectDate,
      handbackDate,
      totalBooks,
      markedCount,
      dailyRate: dailyRateFor(totalBooks, collectDate, handbackDate),
      locked: true,
    })
    .where(eq(markingPlans.id, id));
  revalidatePath("/", "layout");
  return { ok: true };
}
