import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import {
  classes,
  markingPlans,
  timetableSlots,
  unavailableDates,
  type PlanRow,
} from "@/db/schema";
import { todayStr } from "@/lib/dates";
import { generateSchedule } from "@/lib/engine";
import { getSettings } from "@/lib/queries";

export type PlanRebuildResult = {
  count: number;
  rebuilt: boolean;
};

/**
 * Rebuild the part of the diary that is still safe for the smart planner to
 * change. Collected, manual and explicitly locked plans are all constraints;
 * only untouched auto suggestions are replaced.
 */
export async function rebuildAutoPlansForUser(
  userId: number,
  today = todayStr(),
): Promise<PlanRebuildResult> {
  const [classRows, slotRows, existingPlans, settings, unavailableRows] =
    await Promise.all([
      db.select().from(classes).where(eq(classes.userId, userId)),
      db.select().from(timetableSlots).where(eq(timetableSlots.userId, userId)),
      db.select().from(markingPlans).where(eq(markingPlans.userId, userId)),
      getSettings(userId),
      db
        .select()
        .from(unavailableDates)
        .where(eq(unavailableDates.userId, userId)),
    ]);

  // Keep the existing diary intact until the planner has enough information
  // to make useful replacements.
  if (classRows.length === 0 || slotRows.length === 0)
    return { count: 0, rebuilt: false };

  const suggestions = generateSchedule({
    classes: classRows,
    slots: slotRows,
    plans: existingPlans,
    settings,
    today,
    unavailableDates: unavailableRows.map((row) => row.date),
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

  if (suggestions.length > 0) {
    const classById = new Map(classRows.map((cls) => [cls.id, cls]));
    await db.insert(markingPlans).values(
      suggestions.map((suggestion) => ({
        userId,
        classId: suggestion.classId,
        title: "Formative check",
        planType: "auto" as const,
        status: "scheduled" as const,
        collectDate: suggestion.collectDate,
        collectPeriod: suggestion.collectPeriod,
        handbackDate: suggestion.handbackDate,
        handbackPeriod: suggestion.handbackPeriod,
        totalBooks: classById.get(suggestion.classId)?.studentCount ?? 30,
        dailyRate: suggestion.dailyRate,
        late: suggestion.late,
      })),
    );
  }

  return { count: suggestions.length, rebuilt: true };
}

/** An untouched automatic collection date in the past must never stay in the diary. */
export function hasStaleAutoPlans(plans: PlanRow[], today: string): boolean {
  return plans.some(
    (plan) =>
      plan.status === "scheduled" &&
      plan.planType === "auto" &&
      !plan.locked &&
      plan.collectDate < today,
  );
}
