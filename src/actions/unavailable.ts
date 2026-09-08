"use client";

import type { ActionResult } from "@/actions/classes";
import { restaggerDiary } from "@/actions/plans";
import { mutate, getDb, nextId } from "@/lib/store";
import { addDays, diffDays, isValidDate, isWeekday } from "@/lib/dates";

export async function addUnavailableDatesAction(
  formData: FormData,
): Promise<ActionResult & { count?: number }> {
  const from = String(formData.get("from") ?? "");
  const to = String(formData.get("to") ?? from);
  const reason = String(formData.get("reason") ?? "").trim().slice(0, 120);

  if (!isValidDate(from) || !isValidDate(to)) {
    return { ok: false, error: "Choose valid dates." };
  }
  if (to < from) {
    return { ok: false, error: "The end date must be after the start date." };
  }
  if (diffDays(from, to) > 180) {
    return { ok: false, error: "Block up to six months at a time." };
  }

  const dates: string[] = [];
  for (let cursor = from; cursor <= to; cursor = addDays(cursor, 1)) {
    if (isWeekday(cursor)) dates.push(cursor);
  }
  if (dates.length === 0) {
    return {
      ok: false,
      error: "That range only contains weekend days, which are already skipped.",
    };
  }

  const existing = new Set(getDb().unavailableDates.map((day) => day.date));
  let count = 0;
  mutate((draft) => {
    for (const date of dates) {
      if (existing.has(date)) continue;
      draft.unavailableDates.push({
        id: nextId(draft),
        date,
        reason,
        createdAt: new Date().toISOString(),
      });
      existing.add(date);
      count += 1;
    }
    draft.unavailableDates.sort((a, b) => a.date.localeCompare(b.date));
  });

  await restaggerDiary();
  return { ok: true, count };
}

export async function removeUnavailableDateAction(id: number): Promise<ActionResult> {
  mutate((draft) => {
    draft.unavailableDates = draft.unavailableDates.filter((day) => day.id !== id);
  });
  await restaggerDiary();
  return { ok: true };
}
