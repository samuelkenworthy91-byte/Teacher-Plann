"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, markingEntries, markingPlans } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import {
  addSchoolDays,
  clampInt,
  isAvailableSchoolDay,
  isValidDate,
  todayStr,
} from "@/lib/dates";
import { dailyRateFor } from "@/lib/engine";
import { hasStaleAutoPlans, rebuildAutoPlansForUser } from "@/lib/plan-sync";
import { getUnavailableDates } from "@/lib/queries";
import { and, desc, eq } from "drizzle-orm";
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

async function unavailableDateSet(userId: number): Promise<Set<string>> {
  const dates = await getUnavailableDates(userId);
  return new Set(dates.map((day) => day.date));
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
  const unavailableDates = await unavailableDateSet(user.id);
  const collect = addSchoolDays(today, 0, unavailableDates);
  const total = totalOverride > 0 ? totalOverride : cls.studentCount;
  const handback = deadline < collect ? collect : deadline;
  if (unavailableDates.has(handback)) {
    return {
      ok: false,
      error: "That hand-back date is protected. Pick a working day instead.",
    };
  }

  const [row] = await db
    .insert(markingPlans)
    .values({
      userId: user.id,
      classId,
      title,
      planType: "manual",
      status: "marking",
      collectDate: collect,
      handbackDate: handback,
      totalBooks: total,
      dailyRate: dailyRateFor(total, collect, handback, unavailableDates),
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
  const unavailableDates = await unavailableDateSet(user.id);
  if (!isAvailableSchoolDay(today, unavailableDates)) {
    return {
      ok: false,
      error:
        "Today is protected from work and marking. Choose the next working day.",
    };
  }
  const requestedHandback = handbackDate || plan.handbackDate;
  if (!isValidDate(requestedHandback))
    return { ok: false, error: "Pick a valid hand-back date." };
  if (requestedHandback < today) {
    return {
      ok: false,
      error: "The hand-back date cannot be before today’s collection.",
    };
  }
  if (unavailableDates.has(requestedHandback)) {
    return {
      ok: false,
      error: "That hand-back date is protected. Pick a working day instead.",
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
      dailyRate: dailyRateFor(
        plan.totalBooks,
        today,
        requestedHandback,
        unavailableDates,
      ),
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
  if (!Number.isFinite(delta))
    return { ok: false, error: "Enter a whole number of books." };

  const today = todayStr();
  const unavailableDates = await unavailableDateSet(user.id);
  if (!isAvailableSchoolDay(today, unavailableDates)) {
    return { ok: false, error: "Today is protected from marking." };
  }

  const next = Math.max(
    0,
    Math.min(plan.totalBooks, plan.markedCount + Math.round(delta)),
  );
  const actualDelta = next - plan.markedCount;
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

/** Remove the whole most-recent marking input, including a mistaken bulk entry. */
export async function undoLastMarkingAction(
  id: number,
): Promise<ActionResult & { undoneCount?: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const plan = await ownPlan(user.id, id);
  if (!plan) return { ok: false, error: "Plan not found." };
  if (plan.status !== "marking")
    return { ok: false, error: "This pile is not open for marking." };

  const [lastEntry] = await db
    .select()
    .from(markingEntries)
    .where(
      and(eq(markingEntries.planId, id), eq(markingEntries.userId, user.id)),
    )
    .orderBy(desc(markingEntries.createdAt), desc(markingEntries.id))
    .limit(1);
  if (!lastEntry)
    return { ok: false, error: "There is no marking input to undo." };

  const correctedCount = Math.max(
    0,
    Math.min(plan.totalBooks, plan.markedCount - lastEntry.count),
  );
  await db.delete(markingEntries).where(eq(markingEntries.id, lastEntry.id));
  await db
    .update(markingPlans)
    .set({ markedCount: correctedCount })
    .where(eq(markingPlans.id, id));

  refreshApp();
  return { ok: true, undoneCount: lastEntry.count };
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
  const unavailableDates = await unavailableDateSet(user.id);
  if (!isAvailableSchoolDay(returnedToday, unavailableDates)) {
    return {
      ok: false,
      error:
        "Today is protected from work and marking. Hand the books back on a working day.",
    };
  }

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

  const unavailableDates = await unavailableDateSet(user.id);
  if (unavailableDates.has(collectDate) || unavailableDates.has(handbackDate)) {
    return { ok: false, error: "Choose dates outside your protected days." };
  }

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
      dailyRate: dailyRateFor(
        totalBooks,
        collectDate,
        handbackDate,
        unavailableDates,
      ),
      locked: true,
    })
    .where(eq(markingPlans.id, id));

  // Edited plans are fixed constraints; recalculate every flexible task around them.
  await rebuildAutoPlansForUser(user.id);
  refreshApp();
  return { ok: true };
}
