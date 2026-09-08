"use server";

import { and, eq } from "drizzle-orm";
import { revalidatePath } from "next/cache";
import type { ActionResult } from "@/actions/classes";
import { db } from "@/db";
import { unavailableDates } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { addDays, diffDays, isValidDate, isWeekday } from "@/lib/dates";
import { rebuildAutoPlansForUser } from "@/lib/plan-sync";

export async function addUnavailableDatesAction(
  formData: FormData,
): Promise<ActionResult & { count?: number }> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? from);
  const reason = String(formData.get("reason") ?? "")
    .trim()
    .slice(0, 120);

  if (!isValidDate(from) || !isValidDate(to)) {
    return { ok: false, error: "Choose valid dates." };
  }
  if (to < from)
    return { ok: false, error: "The end date must be after the start date." };
  if (diffDays(from, to) > 180) {
    return { ok: false, error: "Block up to six months at a time." };
  }

  const dates: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    // Weekends are already non-working days, so only store dates that affect
    // scheduling and pace calculations.
    if (isWeekday(cursor)) dates.push(cursor);
  }
  if (dates.length === 0) {
    return {
      ok: false,
      error:
        "That range only contains weekend days, which are already skipped.",
    };
  }

  const inserted = await db
    .insert(unavailableDates)
    .values(dates.map((date) => ({ userId: user.id, date, reason })))
    .onConflictDoNothing()
    .returning({ id: unavailableDates.id });
  await rebuildAutoPlansForUser(user.id);
  revalidatePath("/", "layout");
  return { ok: true, count: inserted.length };
}

export async function removeUnavailableDateAction(
  id: number,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  await db
    .delete(unavailableDates)
    .where(
      and(eq(unavailableDates.id, id), eq(unavailableDates.userId, user.id)),
    );
  await rebuildAutoPlansForUser(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}
