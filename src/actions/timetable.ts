"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes, timetablePhotos, timetableSlots } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { rebuildAutoPlansForUser } from "@/lib/plan-sync";
import { and, eq } from "drizzle-orm";
import type { ActionResult } from "@/actions/classes";

export async function setSlotAction(
  dayOfWeek: number,
  period: number,
  classId: number | null,
): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (dayOfWeek < 1 || dayOfWeek > 5 || period < 1 || period > 6) {
    return { ok: false, error: "Out of range." };
  }

  if (classId === null) {
    await db
      .delete(timetableSlots)
      .where(
        and(
          eq(timetableSlots.userId, user.id),
          eq(timetableSlots.dayOfWeek, dayOfWeek),
          eq(timetableSlots.period, period),
        ),
      );
  } else {
    const [ownClass] = await db
      .select({ id: classes.id })
      .from(classes)
      .where(and(eq(classes.id, classId), eq(classes.userId, user.id)))
      .limit(1);
    if (!ownClass) return { ok: false, error: "Pick one of your own classes." };

    await db
      .insert(timetableSlots)
      .values({ userId: user.id, classId, dayOfWeek, period })
      .onConflictDoUpdate({
        target: [
          timetableSlots.userId,
          timetableSlots.dayOfWeek,
          timetableSlots.period,
        ],
        set: { classId },
      });
  }
  // Lesson changes affect every unlocked suggestion immediately.
  await rebuildAutoPlansForUser(user.id);
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function savePhotoAction(dataUrl: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!dataUrl.startsWith("data:image/"))
    return { ok: false, error: "That file isn't an image." };
  if (dataUrl.length > 2_800_000) {
    return {
      ok: false,
      error: "Photo is too large — try a smaller image (under ~2 MB).",
    };
  }
  await db
    .insert(timetablePhotos)
    .values({ userId: user.id, dataUrl, updatedAt: new Date() })
    .onConflictDoUpdate({
      target: timetablePhotos.userId,
      set: { dataUrl, updatedAt: new Date() },
    });
  revalidatePath("/", "layout");
  return { ok: true };
}

export async function clearPhotoAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  await db.delete(timetablePhotos).where(eq(timetablePhotos.userId, user.id));
  revalidatePath("/", "layout");
  return { ok: true };
}
