"use server";

import { revalidatePath } from "next/cache";
import { db } from "@/db";
import { classes } from "@/db/schema";
import { getCurrentUser } from "@/lib/auth";
import { clampInt } from "@/lib/dates";
import { and, eq } from "drizzle-orm";

export type ActionResult = { ok: boolean; error?: string; id?: number };

export async function createClassAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const yearGroup = String(formData.get("yearGroup") ?? "").trim();
  const color = String(formData.get("color") ?? "#D94F26");
  const studentCount = clampInt(formData.get("studentCount"), 1, 60, 30);

  if (name.length < 2) return { ok: false, error: "Give the class a name, e.g. 9X/Sc1." };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { ok: false, error: "Pick a colour." };

  const [row] = await db
    .insert(classes)
    .values({ userId: user.id, name, subject, yearGroup, studentCount, color })
    .returning();
  revalidatePath("/", "layout");
  return { ok: true, id: row.id };
}

export async function updateClassAction(formData: FormData): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };

  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const yearGroup = String(formData.get("yearGroup") ?? "").trim();
  const color = String(formData.get("color") ?? "#D94F26");
  const studentCount = clampInt(formData.get("studentCount"), 1, 60, 30);

  if (!Number.isFinite(id)) return { ok: false, error: "Missing class id." };
  if (name.length < 2) return { ok: false, error: "Give the class a name." };

  await db
    .update(classes)
    .set({ name, subject, yearGroup, studentCount, color })
    .where(and(eq(classes.id, id), eq(classes.userId, user.id)));
  revalidatePath("/", "layout");
  return { ok: true, id };
}

export async function deleteClassAction(id: number): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  await db.delete(classes).where(and(eq(classes.id, id), eq(classes.userId, user.id)));
  revalidatePath("/", "layout");
  return { ok: true };
}
