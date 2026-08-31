"use client";

import { mutate, nextId } from "@/lib/store";
import type { ActionResult } from "@/actions/classes";

export async function setSlotAction(
  dayOfWeek: number,
  period: number,
  classId: number | null,
): Promise<ActionResult> {
  if (dayOfWeek < 1 || dayOfWeek > 5 || period < 1 || period > 6) {
    return { ok: false, error: "Out of range." };
  }

  mutate((db) => {
    const rest = db.slots.filter((s) => !(s.dayOfWeek === dayOfWeek && s.period === period));
    db.slots =
      classId === null ? rest : [...rest, { id: nextId(db), classId, dayOfWeek, period }];
  });
  return { ok: true };
}

export async function savePhotoAction(dataUrl: string): Promise<ActionResult> {
  if (!dataUrl.startsWith("data:image/")) return { ok: false, error: "That file isn't an image." };
  if (dataUrl.length > 2_800_000) {
    return { ok: false, error: "Photo is too large — try a smaller image (under ~2 MB)." };
  }
  mutate((db) => {
    db.photo = dataUrl;
  });
  return { ok: true };
}

export async function clearPhotoAction(): Promise<ActionResult> {
  mutate((db) => {
    db.photo = null;
  });
  return { ok: true };
}
