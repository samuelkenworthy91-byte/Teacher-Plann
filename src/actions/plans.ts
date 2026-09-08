"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, markingEntries, markingPlans } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { clampInt, isValidDate, todayStr } from "@/lib/dates";
import { dailyRateFor } from "@/lib/engine";
import { hasStaleAutoPlans, rebuildAutoPlansForUser } from "@/lib/plan-sync";
import { and, eq } from "drizzle-orm";
import type { ActionResult } from "@/actions/classes";

async function ownPlan(userId: number, id: number) {
  const [row] = await db
    .select()
    .from(markingPlans)
    .where(and(eq(markingPlans.id, id), eq(markingPlans.userId, userId)))
    .limit(1);
  return row ?? null;
}

function refreshApp() {
  revalidatePath("/", "layout");
}

/* ------------------------------------------------------------------ */
/* Smart planner                                                       */
/* ------------------------------------------------------------------ */

export async function generatePlanAction(): Promise<
  ActionResult & { count?: number }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const rebuilt = await rebuildAutoPlansForUser(user.id);
  if (!rebuilt.rebuilt)
    return {
      ok: false,
      error: "Add a class and fill in your timetable first.",
    };

  refreshApp();
  return { ok: true, count: rebuilt.count };
}

/**
 * Runs quietly when the app opens and finds an untouched auto collection in
 * the past. A missed collection is an expired suggestion, not a task the
 * teacher still has to clear by hand.
 */
export async function refreshStalePlanAction(): Promise<
  ActionResult & { refreshed?: boolean; count?: number }
> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const today = todayStr();
  const plans = await db
    .select()
    .from(markingPlans)
    .where(eq(markingPlans.userId, user.id));
  if (!hasStaleAutoPlans(plans, today))
    return { ok: true, refreshed: false, count: 0 };

  const rebuilt = await rebuildAutoPlansForUser(user.id, today);
  if (!rebuilt.rebuilt)
    return {
      ok: false,
      error: "Add a class and fill in your timetable first.",
    };

  refreshApp();
  return { ok: true, refreshed: true, count: rebuilt.count };
}

/* ------------------------------------------------------------------ */
/* Manual deadline task                                                */
/* ------------------------------------------------------------------ */

export async function createTaskAction(
  formData: FormData,
): Promise<ActionResult> {
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
  if (!isValidDate(deadline))
    return { ok: false, error: "Pick a valid hand-back date." };

  const today = todayStr();
  const total = totalOverride > 0 ? totalOverride : cls.studentCount;
  const handback = deadline < today ? today : deadline;

  const [row] = await db
    .insert(markingPlans)
    .values({
      userId: user.id,
      classId,
      title,
      planType: "manual",
      status: "marking",
      collectDate: today,
      handbackDate: handback,
      totalBooks: total,
      dailyRate: dailyRateFor(total, today, handback),
      locked: true,
    })
    .returning();

  // A manual deadline is a new hard constraint, so move any still-flexible
  // automatic work around it straight away.
  await rebuildAutoPlansForUser(user.id, today);
  refreshApp();
  return { ok: true, id: row.id };
}

/* ------------------------------------------------------------------ */
/* Lifecycle                                                           */
/* ------------------------------------------------------------------ */

/**
 * Confirm a collection. The actual collection date is always today; the
 * teacher can choose a realistic hand-back date before confirming.
 */
export async function collectPlanAction(
  id: number,
  handbackDate?: string,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "scheduled")
    return { ok: false, error: "This pile has already been collected." };

  const today = todayStr();
  const requestedHandback = handbackDate || plan.handbackDate;
  if (!isValidDate(requestedHandback))
    return { ok: false, error: "Pick a valid hand-back date." };
  if (requestedHandback < today) {
    return {
      ok: false,
      error: "The hand-back date cannot be before today’s collection.",
    };
  }

  const datesChanged = requestedHandback !== plan.handbackDate;
  await db
    .update(markingPlans)
    .set({
      status: "marking",
      collectDate: today,
      // Retain a lesson period only when the original date is still accurate.
      collectPeriod: plan.collectDate === today ? plan.collectPeriod : null,
      handbackDate: requestedHandback,
      handbackPeriod: datesChanged ? null : plan.handbackPeriod,
      dailyRate: dailyRateFor(plan.totalBooks, today, requestedHandback),
      locked: true,
    })
    .where(eq(markingPlans.id, id));

  await rebuildAutoPlansForUser(user.id, today);
  refreshApp();
  return { ok: true };
}

export async function logBooksAction(
  id: number,
  delta: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "marking")
    return { ok: false, error: "Collect the books first." };

  const next = Math.max(
    0,
    Math.min(plan.totalBooks, plan.markedCount + Math.round(delta)),
  );
  const actualDelta = next - plan.markedCount;
  const today = todayStr();
  if (actualDelta !== 0) {
    await db
      .insert(markingEntries)
      .values({ planId: id, userId: user.id, date: today, count: actualDelta });
    await db
      .update(markingPlans)
      .set({ markedCount: next })
      .where(eq(markingPlans.id, id));
  }
  refreshApp();
  return { ok: true };
}

/** Mark a pile as handed back today and make today the recorded hand-back date. */
export async function returnPlanAction(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "marking")
    return { ok: false, error: "Collect the books before handing them back." };

  const returnedToday = todayStr();
  await db
    .update(markingPlans)
    .set({
      status: "returned",
      // This is the real completed date, not the old planned estimate.
      handbackDate: returnedToday,
      handbackPeriod:
        plan.handbackDate === returnedToday ? plan.handbackPeriod : null,
      returnedAt: returnedToday,
      locked: true,
    })
    .where(eq(markingPlans.id, id));

  // The next feedback cycle is now due from the actual hand-back date.
  await rebuildAutoPlansForUser(user.id, returnedToday);
  refreshApp();
  return { ok: true };
}

export async function reopenPlanAction(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "returned")
    return { ok: false, error: "This pile is already open." };

  await db
    .update(markingPlans)
    .set({ status: "marking", returnedAt: null })
    .where(eq(markingPlans.id, id));
  await rebuildAutoPlansForUser(user.id);
  refreshApp();
  return { ok: true };
}

export async function deletePlanAction(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };

  await db.delete(markingPlans).where(eq(markingPlans.id, id));
  // Removing a deadline/active pile frees space in the diary immediately.
  await rebuildAutoPlansForUser(user.id);
  refreshApp();
  return { ok: true };
}

export async function toggleLockAction(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };
  await db
    .update(markingPlans)
    .set({ locked: !plan.locked })
    .where(eq(markingPlans.id, id));
  await rebuildAutoPlansForUser(user.id);
  refreshApp();
  return { ok: true };
}

export async function updatePlanAction(
  formData: FormData,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const id = Number(formData.get("id"));
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };

  const title = String(formData.get("title") ?? "").trim() || plan.title;
  const collectDate = String(formData.get("collectDate") ?? plan.collectDate);
  const handbackDate = String(
    formData.get("handbackDate") ?? plan.handbackDate,
  );
  const totalBooks = clampInt(
    formData.get("totalBooks"),
    1,
    400,
    plan.totalBooks,
  );

  if (!isValidDate(collectDate) || !isValidDate(handbackDate)) {
    return { ok: false, error: "Dates need to be valid calendar dates." };
  }
  if (handbackDate < collectDate)
    return { ok: false, error: "Hand-back must be after collection." };

  const markedCount = Math.min(plan.markedCount, totalBooks);
  await db
    .update(markingPlans)
    .set({
      title,
      collectDate,
      handbackDate,
      // A date moved by hand is no longer tied to the old timetable period.
      collectPeriod:
        collectDate === plan.collectDate ? plan.collectPeriod : null,
      handbackPeriod:
        handbackDate === plan.handbackDate ? plan.handbackPeriod : null,
      totalBooks,
      markedCount,
      dailyRate: dailyRateFor(totalBooks, collectDate, handbackDate),
      locked: true,
    })
    .where(eq(markingPlans.id, id));

  // Edited plans are fixed constraints; recalculate every flexible task around them.
  await rebuildAutoPlansForUser(user.id);
  refreshApp();
  return { ok: true };
}
