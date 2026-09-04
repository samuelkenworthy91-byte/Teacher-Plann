"use client";

/** Demo data for the offline Android app. */

import { addDays, addSchoolDays, todayStr, weekday } from "@/lib/dates";
import { computeHandback, dailyRateFor, generateSchedule } from "@/lib/engine";
import { emptyDatabase, replaceDb } from "@/lib/store";
import type { ClassRow, Database, PlanRow, SlotRow } from "@/lib/types";

const CLASS_SEED = [
  { name: "7X/Sc1", subject: "Science", yearGroup: "Year 7", studentCount: 30, color: "#2563EB" },
  { name: "7Y/Sc2", subject: "Science", yearGroup: "Year 7", studentCount: 28, color: "#0D9488" },
  { name: "8X/Sc1", subject: "Science", yearGroup: "Year 8", studentCount: 31, color: "#7C3AED" },
  { name: "9X/Sc1", subject: "Science", yearGroup: "Year 9", studentCount: 30, color: "#D94F26" },
  { name: "9Y/Sc2", subject: "Science", yearGroup: "Year 9", studentCount: 29, color: "#DB2777" },
  { name: "10A/Sc1", subject: "Combined Science", yearGroup: "Year 10", studentCount: 26, color: "#CA8A04" },
  { name: "10B/Sc2", subject: "Combined Science", yearGroup: "Year 10", studentCount: 27, color: "#475569" },
  { name: "11A/Sc1", subject: "Triple Science", yearGroup: "Year 11", studentCount: 24, color: "#059669" },
] as const;

const SLOT_SEED: [string, number, number][] = [
  ["8X/Sc1", 1, 1], ["7X/Sc1", 1, 2], ["10A/Sc1", 1, 3], ["9X/Sc1", 1, 4], ["11A/Sc1", 1, 5],
  ["9Y/Sc2", 2, 1], ["10B/Sc2", 2, 2], ["8X/Sc1", 2, 3], ["7Y/Sc2", 2, 4], ["11A/Sc1", 2, 5],
  ["7X/Sc1", 3, 1], ["10B/Sc2", 3, 2], ["9X/Sc1", 3, 3], ["10A/Sc1", 3, 4], ["9Y/Sc2", 3, 5],
  ["10A/Sc1", 4, 1], ["7Y/Sc2", 4, 2], ["10B/Sc2", 4, 3], ["8X/Sc1", 4, 4], ["11A/Sc1", 4, 5],
  ["9X/Sc1", 5, 1], ["9Y/Sc2", 5, 2], ["7X/Sc1", 5, 3], ["10A/Sc1", 5, 4], ["11A/Sc1", 5, 6],
];

export function buildDemoDatabase(): Database {
  const db = emptyDatabase();
  const today = todayStr();
  const dow = weekday(today);
  let seq = 1;
  const id = () => ++seq;

  db.profile = { name: "Alex Morgan" };

  const classes: ClassRow[] = CLASS_SEED.map((c) => ({
    id: id(),
    name: c.name,
    subject: c.subject,
    yearGroup: c.yearGroup,
    studentCount: c.studentCount,
    color: c.color,
    createdAt: today,
  }));
  const byName = new Map(classes.map((c) => [c.name, c]));

  const slots: SlotRow[] = SLOT_SEED.map(([name, dayOfWeek, period]) => ({
    id: id(),
    classId: byName.get(name)!.id,
    dayOfWeek,
    period,
  }));

  const plans: PlanRow[] = [];
  const entries = db.entries;

  const blankPlan = (over: Partial<PlanRow> & { classId: number }): PlanRow => ({
    id: id(),
    title: "Formative check",
    planType: "auto",
    status: "scheduled",
    collectDate: today,
    collectPeriod: null,
    handbackDate: today,
    handbackPeriod: null,
    totalBooks: 30,
    markedCount: 0,
    dailyRate: 6,
    locked: false,
    late: false,
    deferredCount: 0,
    returnedAt: null,
    notes: "",
    createdAt: today,
    ...over,
  });

  const mkReturned = (name: string, collectOffset: number, handbackOffset: number, pace: number[]) => {
    const cls = byName.get(name)!;
    const collect = addDays(today, collectOffset);
    const handback = addDays(today, handbackOffset);
    const plan = blankPlan({
      classId: cls.id,
      status: "returned",
      collectDate: collect,
      handbackDate: handback,
      totalBooks: cls.studentCount,
      markedCount: cls.studentCount,
      dailyRate: dailyRateFor(cls.studentCount, collect, handback),
      locked: true,
      returnedAt: handback,
    });
    plans.push(plan);
    let cursor = collect;
    for (const count of pace) {
      entries.push({ id: id(), planId: plan.id, date: cursor, count, createdAt: cursor });
      cursor = addSchoolDays(cursor, 1);
    }
  };

  mkReturned("9X/Sc1", -19, -12, [6, 6, 6, 6, 6]);
  mkReturned("7X/Sc1", -13, -8, [7, 6, 6, 6, 5]);

  const tenA = byName.get("10A/Sc1")!;
  const collect10A = addSchoolDays(today, -2);
  const handback10A = addSchoolDays(today, 3);
  const active = blankPlan({
    classId: tenA.id,
    status: "marking",
    collectDate: collect10A,
    collectPeriod: 4,
    handbackDate: handback10A,
    handbackPeriod: 1,
    totalBooks: tenA.studentCount,
    markedCount: 12,
    dailyRate: dailyRateFor(tenA.studentCount, collect10A, handback10A),
    locked: true,
  });
  plans.push(active);
  entries.push({ id: id(), planId: active.id, date: collect10A, count: 6, createdAt: collect10A });
  const secondDay = addSchoolDays(collect10A, 1);
  entries.push({ id: id(), planId: active.id, date: secondDay, count: 6, createdAt: secondDay });

  const eightX = byName.get("8X/Sc1")!;
  const eightXPeriod =
    (dow >= 1 && dow <= 5 ? SLOT_SEED.find(([n, d]) => n === "8X/Sc1" && d === dow)?.[2] : 3) ?? 3;
  const eightXHandback = computeHandback(eightX.id, slots, { date: today, period: eightXPeriod }, 5);
  plans.push(
    blankPlan({
      classId: eightX.id,
      status: "scheduled",
      collectDate: today,
      collectPeriod: eightXPeriod,
      handbackDate: eightXHandback.date,
      handbackPeriod: eightXHandback.period,
      totalBooks: eightX.studentCount,
      dailyRate: dailyRateFor(eightX.studentCount, today, eightXHandback.date),
      locked: true,
    }),
  );

  const suggestions = generateSchedule({ classes, slots, plans, settings: db.settings, today });
  for (const s of suggestions) {
    plans.push(
      blankPlan({
        classId: s.classId,
        status: "scheduled",
        collectDate: s.collectDate,
        collectPeriod: s.collectPeriod,
        handbackDate: s.handbackDate,
        handbackPeriod: s.handbackPeriod,
        totalBooks: classes.find((c) => c.id === s.classId)?.studentCount ?? 30,
        dailyRate: s.dailyRate,
        late: s.late,
      }),
    );
  }

  db.classes = classes.sort((a, b) => a.name.localeCompare(b.name));
  db.slots = slots;
  db.plans = plans.sort((a, b) => b.collectDate.localeCompare(a.collectDate));
  db.entries = entries.sort((a, b) => b.date.localeCompare(a.date));
  db.seq = seq;
  return db;
}

export function loadDemoData() {
  replaceDb(buildDemoDatabase());
}
