"use client";

import { mutate, nextId } from "@/lib/store";
import { clampInt, todayStr } from "@/lib/dates";
import type { ClassRow } from "@/lib/types";

export type ActionResult = { ok: boolean; error?: string; id?: number };

const byName = (a: ClassRow, b: ClassRow) => a.name.localeCompare(b.name);

export async function createClassAction(formData: FormData): Promise<ActionResult> {
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const yearGroup = String(formData.get("yearGroup") ?? "").trim();
  const color = String(formData.get("color") ?? "#D94F26");
  const studentCount = clampInt(formData.get("studentCount"), 1, 60, 30);

  if (name.length < 2) return { ok: false, error: "Give the class a name, e.g. 9X/Sc1." };
  if (!/^#[0-9a-fA-F]{6}$/.test(color)) return { ok: false, error: "Pick a colour." };

  let id = 0;
  mutate((db) => {
    id = nextId(db);
    db.classes = [
      ...db.classes,
      { id, name, subject, yearGroup, studentCount, color, createdAt: todayStr() },
    ].sort(byName);
  });
  return { ok: true, id };
}

export async function updateClassAction(formData: FormData): Promise<ActionResult> {
  const id = Number(formData.get("id"));
  const name = String(formData.get("name") ?? "").trim();
  const subject = String(formData.get("subject") ?? "").trim();
  const yearGroup = String(formData.get("yearGroup") ?? "").trim();
  const color = String(formData.get("color") ?? "#D94F26");
  const studentCount = clampInt(formData.get("studentCount"), 1, 60, 30);

  if (!Number.isFinite(id)) return { ok: false, error: "Missing class id." };
  if (name.length < 2) return { ok: false, error: "Give the class a name." };

  mutate((db) => {
    db.classes = db.classes
      .map((c) => (c.id === id ? { ...c, name, subject, yearGroup, studentCount, color } : c))
      .sort(byName);
  });
  return { ok: true, id };
}

export async function deleteClassAction(id: number): Promise<ActionResult> {
  mutate((db) => {
    db.classes = db.classes.filter((c) => c.id !== id);
    db.slots = db.slots.filter((s) => s.classId !== id);
    const doomed = new Set(db.plans.filter((p) => p.classId === id).map((p) => p.id));
    db.plans = db.plans.filter((p) => p.classId !== id);
    db.entries = db.entries.filter((e) => !doomed.has(e.planId));
  });
  return { ok: true };
}
