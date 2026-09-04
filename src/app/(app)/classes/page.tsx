"use client";

import { computeClassHealth } from "@/lib/engine";
import { prettyShort } from "@/lib/dates";
import { ClassManager, type ClassVM } from "@/components/class-manager";
import { useBundle } from "@/lib/store";

export default function ClassesPage() {
  const bundle = useBundle();
  if (!bundle) return null;
  const { classes, slots, plans, settings, today } = bundle;

  const vms: ClassVM[] = classes.map((c) => {
    const h = computeClassHealth(c, slots, plans, settings, today);
    const next = plans
      .filter((p) => p.classId === c.id && p.status !== "returned")
      .sort((a, b) => a.collectDate.localeCompare(b.collectDate))[0];
    return {
      id: c.id,
      name: c.name,
      subject: c.subject,
      yearGroup: c.yearGroup,
      studentCount: c.studentCount,
      color: c.color,
      lessonsPerWeek: slots.filter((s) => s.classId === c.id).length,
      nextLabel: next
        ? next.status === "marking"
          ? "On your desk now"
          : `Collects ${prettyShort(next.collectDate)}`
        : null,
      healthLabel:
        h.status === "overdue" ? "Overdue" : h.status === "due" ? "Due soon" : h.status === "fresh" ? "Covered" : "Building",
      healthTone: h.status,
    };
  });

  return (
    <div className="space-y-6">
      <header className="rise">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-pen">Core resource</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">My classes</h1>
        <p className="mt-1 max-w-lg text-[0.88rem] text-ink-soft">
          Class sizes drive every "mark N a day" calculation — keep them honest.
        </p>
      </header>
      <ClassManager classes={vms} />
    </div>
  );
}
