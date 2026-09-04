import "dotenv/config";
import { db } from "@/db";
import {
  classes,
  markingEntries,
  markingPlans,
  timetableSlots,
  users,
  userSettings,
  type PlanRow,
} from "@/db/schema";
import { hashPassword } from "@/lib/password";
import { addDays, addSchoolDays, todayStr, weekday } from "@/lib/dates";
import { computeHandback, dailyRateFor, generateSchedule } from "@/lib/engine";
import { eq } from "drizzle-orm";

const PERIODS = 6;

async function main() {
  const existing = await db.select({ id: users.id }).from(users).limit(1);
  if (existing.length > 0) {
    console.log("Database already has users — skipping seed.");
    process.exit(0);
  }

  console.log("Seeding MarkFlow demo data…");
  const today = todayStr();
  const dow = weekday(today); // 0 Sun … 6 Sat

  const [demo] = await db
    .insert(users)
    .values({
      name: "Alex Morgan",
      email: "demo@markflow.app",
      passwordHash: hashPassword("demo1234"),
    })
    .returning();
  await db.insert(userSettings).values({
    userId: demo.id,
    minLessons: 4,
    maxLessons: 8,
    maxGapDays: 14,
    windowDays: 5,
  });

  // ---------------------------------------------------------------
  // Classes — one science teacher's full load
  // ---------------------------------------------------------------
  const classSeed = [
    { key: "7X/Sc1", subject: "Science", yearGroup: "Year 7", studentCount: 30, color: "#2563EB" },
    { key: "7Y/Sc2", subject: "Science", yearGroup: "Year 7", studentCount: 28, color: "#0D9488" },
    { key: "8X/Sc1", subject: "Science", yearGroup: "Year 8", studentCount: 31, color: "#7C3AED" },
    { key: "9X/Sc1", subject: "Science", yearGroup: "Year 9", studentCount: 30, color: "#D94F26" },
    { key: "9Y/Sc2", subject: "Science", yearGroup: "Year 9", studentCount: 29, color: "#DB2777" },
    { key: "10A/Sc1", subject: "Combined Science", yearGroup: "Year 10", studentCount: 26, color: "#CA8A04" },
    { key: "10B/Sc2", subject: "Combined Science", yearGroup: "Year 10", studentCount: 27, color: "#475569" },
    { key: "11A/Sc1", subject: "Triple Science", yearGroup: "Year 11", studentCount: 24, color: "#059669" },
  ] as const;

  const inserted = await db
    .insert(classes)
    .values(classSeed.map((c) => ({ userId: demo.id, name: c.key, subject: c.subject, yearGroup: c.yearGroup, studentCount: c.studentCount, color: c.color })))
    .returning();

  const byName = new Map(inserted.map((c) => [c.name, c]));

  // ---------------------------------------------------------------
  // Timetable — Mon..Fri × 6 periods
  // ---------------------------------------------------------------
  const slotSeed: [string, number, number][] = [
    // Monday
    ["8X/Sc1", 1, 1], ["7X/Sc1", 1, 2], ["10A/Sc1", 1, 3], ["9X/Sc1", 1, 4], ["11A/Sc1", 1, 5],
    // Tuesday
    ["9Y/Sc2", 2, 1], ["10B/Sc2", 2, 2], ["8X/Sc1", 2, 3], ["7Y/Sc2", 2, 4], ["11A/Sc1", 2, 5],
    // Wednesday
    ["7X/Sc1", 3, 1], ["10B/Sc2", 3, 2], ["9X/Sc1", 3, 3], ["10A/Sc1", 3, 4], ["9Y/Sc2", 3, 5],
    // Thursday
    ["10A/Sc1", 4, 1], ["7Y/Sc2", 4, 2], ["10B/Sc2", 4, 3], ["8X/Sc1", 4, 4], ["11A/Sc1", 4, 5],
    // Friday
    ["9X/Sc1", 5, 1], ["9Y/Sc2", 5, 2], ["7X/Sc1", 5, 3], ["10A/Sc1", 5, 4], ["11A/Sc1", 5, 6],
  ];

  const slotRows = await db
    .insert(timetableSlots)
    .values(
      slotSeed.map(([name, day, period]) => ({
        userId: demo.id,
        classId: byName.get(name)!.id,
        dayOfWeek: day,
        period,
      })),
    )
    .returning();
  console.log(`  · ${slotRows.length} timetable slots across ${PERIODS} periods`);

  // ---------------------------------------------------------------
  // Marking history + live cycles
  // ---------------------------------------------------------------
  const mkReturned = async (
    name: string,
    title: string,
    collectOffset: number,
    handbackOffset: number,
    pace: number[],
  ) => {
    const cls = byName.get(name)!;
    const collect = addDays(today, collectOffset);
    const handback = addDays(today, handbackOffset);
    const [plan] = await db
      .insert(markingPlans)
      .values({
        userId: demo.id,
        classId: cls.id,
        title,
        planType: "auto",
        status: "returned",
        collectDate: collect,
        handbackDate: handback,
        totalBooks: cls.studentCount,
        markedCount: cls.studentCount,
        dailyRate: dailyRateFor(cls.studentCount, collect, handback),
        locked: true,
        returnedAt: handback,
      })
      .returning();
    let dayCursor = toCollectDay(collect);
    for (const count of pace) {
      await db.insert(markingEntries).values({ planId: plan.id, userId: demo.id, date: dayCursor, count });
      dayCursor = addSchoolDays(dayCursor, 1);
    }
    return plan;
  };

  function toCollectDay(s: string) {
    return s;
  }

  await mkReturned("9X/Sc1", "Formative check", -19, -12, [6, 6, 6, 6, 6]);
  await mkReturned("7X/Sc1", "Formative check", -13, -8, [7, 6, 6, 6, 5]);

  // Live: currently marking 10A — collected 2 (school) days ago, hand back in 3.
  const tenA = byName.get("10A/Sc1")!;
  const collect10A = addSchoolDays(today, -2);
  const handback10A = addSchoolDays(today, 3);
  const [activePlan] = await db
    .insert(markingPlans)
    .values({
      userId: demo.id,
      classId: tenA.id,
      title: "Formative check",
      planType: "auto",
      status: "marking",
      collectDate: collect10A,
      collectPeriod: 4,
      handbackDate: handback10A,
      handbackPeriod: 1,
      totalBooks: tenA.studentCount,
      markedCount: 12,
      dailyRate: dailyRateFor(tenA.studentCount, collect10A, handback10A),
      locked: true,
    })
    .returning();
  await db.insert(markingEntries).values([
    { planId: activePlan.id, userId: demo.id, date: collect10A, count: 6 },
    { planId: activePlan.id, userId: demo.id, date: addSchoolDays(collect10A, 1), count: 6 },
  ]);

  // Due today: collect 8X at their lesson today (or next if weekend seeding).
  const eightX = byName.get("8X/Sc1")!;
  const eightXPeriodToday =
    dow >= 1 && dow <= 5
      ? slotSeed.find(([n, d]) => n === "8X/Sc1" && d === dow)?.[2] ?? 3
      : 3;
  const eightXCollect = today;
  const eightXHandback = computeHandback(eightX.id, slotRows, { date: today, period: eightXPeriodToday }, 5);
  await db.insert(markingPlans).values({
    userId: demo.id,
    classId: eightX.id,
    title: "Formative check",
    planType: "auto",
    status: "scheduled",
    collectDate: eightXCollect,
    collectPeriod: eightXPeriodToday,
    handbackDate: eightXHandback.date,
    handbackPeriod: eightXHandback.period,
    totalBooks: eightX.studentCount,
    dailyRate: dailyRateFor(eightX.studentCount, eightXCollect, eightXHandback.date),
    locked: true,
  });

  // Let the engine fill in the rest of the diary.
  const allPlans: PlanRow[] = await db
    .select()
    .from(markingPlans)
    .where(eq(markingPlans.userId, demo.id));
  const settings = (await db.select().from(userSettings).where(eq(userSettings.userId, demo.id)))[0];
  const suggestions = generateSchedule({
    classes: inserted,
    slots: slotRows,
    plans: allPlans,
    settings,
    today,
  });
  if (suggestions.length > 0) {
    await db.insert(markingPlans).values(
      suggestions.map((s) => ({
        userId: demo.id,
        classId: s.classId,
        title: "Formative check",
        planType: "auto" as const,
        status: "scheduled" as const,
        collectDate: s.collectDate,
        collectPeriod: s.collectPeriod,
        handbackDate: s.handbackDate,
        handbackPeriod: s.handbackPeriod,
        totalBooks: inserted.find((c) => c.id === s.classId)?.studentCount ?? 30,
        dailyRate: s.dailyRate,
        late: s.late,
      })),
    );
  }

  console.log(`  · ${2 + 1 + 1 + suggestions.length} marking cycles (returned, active, due today, upcoming)`);
  console.log("Seed complete. Sign in with demo@markflow.app / demo1234");
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
