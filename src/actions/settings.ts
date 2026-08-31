"use client";

import { mutate } from "@/lib/store";
import { clampInt } from "@/lib/dates";
import type { ActionResult } from "@/actions/classes";

export async function saveSettingsAction(formData: FormData): Promise<ActionResult> {
  const minLessons = clampInt(formData.get("minLessons"), 1, 20, 4);
  const maxLessons = clampInt(formData.get("maxLessons"), minLessons, 30, 8);
  const maxGapDays = clampInt(formData.get("maxGapDays"), 7, 28, 14);
  const windowDays = clampInt(formData.get("windowDays"), 2, 10, 5);
  const name = String(formData.get("name") ?? "").trim();

  mutate((db) => {
    db.settings = { minLessons, maxLessons, maxGapDays, windowDays };
    if (name.length >= 2) db.profile = { ...db.profile, name };
  });
  return { ok: true };
}
