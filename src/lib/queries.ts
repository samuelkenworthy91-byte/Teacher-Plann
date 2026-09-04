import { db } from "@/db";
import {
  classes,
  markingEntries,
  markingPlans,
  timetablePhotos,
  timetableSlots,
  userSettings,
  type ClassRow,
  type EntryRow,
  type PlanRow,
  type SettingsRow,
  type SlotRow,
} from "@/db/schema";
import { addDays, todayStr } from "@/lib/dates";
import { ensureSchema } from "@/lib/bootstrap";
import { eq, desc, gte } from "drizzle-orm";

export async function getSettings(userId: number): Promise<SettingsRow> {
  await ensureSchema();
  const rows = await db.select().from(userSettings).where(eq(userSettings.userId, userId)).limit(1);
  if (rows[0]) return rows[0];
  const inserted = await db
    .insert(userSettings)
    .values({ userId })
    .onConflictDoNothing()
    .returning();
  return (
    inserted[0] ?? {
      userId,
      minLessons: 4,
      maxLessons: 8,
      maxGapDays: 14,
      windowDays: 5,
    }
  );
}

export type Bundle = {
  classes: ClassRow[];
  slots: SlotRow[];
  plans: PlanRow[];
  entries: EntryRow[];
  settings: SettingsRow;
  photo: string | null;
  today: string;
};

export async function getBundle(userId: number): Promise<Bundle> {
  await ensureSchema();
  const today = todayStr();
  const [cls, slt, pln, ent, settings, photoRows] = await Promise.all([
    db.select().from(classes).where(eq(classes.userId, userId)).orderBy(classes.name),
    db.select().from(timetableSlots).where(eq(timetableSlots.userId, userId)),
    db
      .select()
      .from(markingPlans)
      .where(eq(markingPlans.userId, userId))
      .orderBy(desc(markingPlans.collectDate)),
    db
      .select()
      .from(markingEntries)
      .where(gte(markingEntries.date, addDays(today, -120)))
      .orderBy(desc(markingEntries.date)),
    getSettings(userId),
    db.select().from(timetablePhotos).where(eq(timetablePhotos.userId, userId)).limit(1),
  ]);
  // entries are per-user filtered via plan ownership join cost; filter here instead:
  const planIds = new Set(pln.map((p) => p.id));
  const entries = ent.filter((e) => planIds.has(e.planId) || e.userId === userId);
  return { classes: cls, slots: slt, plans: pln, entries, settings, photo: photoRows[0]?.dataUrl ?? null, today };
}
