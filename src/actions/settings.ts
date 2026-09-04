"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { userSettings } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { clampInt } from "@/lib/dates";
import { eq } from "drizzle-orm";
import type { ActionResult } from "@/actions/classes";

export async function saveSettingsAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const minLessons = clampInt(formData.get("minLessons"), 1, 20, 4);
  const maxLessons = clampInt(formData.get("maxLessons"), minLessons, 30, 8);
  const maxGapDays = clampInt(formData.get("maxGapDays"), 7, 28, 14);
  const windowDays = clampInt(formData.get("windowDays"), 2, 10, 5);

  await db
    .insert(userSettings)
    .values({ userId: user.id, minLessons, maxLessons, maxGapDays, windowDays })
    .onConflictDoUpdate({
      target: userSettings.userId,
      set: { minLessons, maxLessons, maxGapDays, windowDays },
    });
  revalidatePath("/", "layout");
  return { ok: true };
}
