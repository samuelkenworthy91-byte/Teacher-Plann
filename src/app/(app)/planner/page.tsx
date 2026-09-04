"use client";

import Link from "next/link";
import { CalendarRange, ShieldCheck, TriangleAlert } from "lucide-react";
import { findClashes, weeklyLoad } from "@/lib/engine";
import { suggestAdhocHandback } from "@/lib/arena-offline";
import { pretty, prettyShort, startOfWeek } from "@/lib/dates";
import { EmptyState } from "@/components/ui";
import { PlannerBoard, type PlanVM } from "@/components/planner-board";
import { AdhocCollect } from "@/components/arena-widgets";
import { useBundle } from "@/lib/store";

export default function PlannerPage() {
  const bundle = useBundle();
  if (!bundle) return null;
  const { classes, slots, plans, settings, today } = bundle;

  if (classes.length === 0 || slots.length === 0) {
    return (
      <div className="rise mx-auto max-w-xl pt-10">
        <EmptyState
          icon={CalendarRange}
          title="The planner needs two ingredients"
          body="Your classes (with sizes) and your timetable. Once it has both, it will schedule every formative so piles stay staggered."
          action={
            <div className="flex gap-2">
              <Link href="/classes" className="btn btn-ghost">Classes</Link>
              <Link href="/timetable" className="btn btn-pen">Timetable</Link>
            </div>
          }
        />
      </div>
    );
  }

  const classById = new Map(classes.map((c) => [c.id, c]));
  const live = plans
    .filter((p) => p.status !== "returned")
    .sort((a, b) => a.collectDate.localeCompare(b.collectDate));
  const clashes = findClashes(plans);
  const load = weeklyLoad(plans, today, 6);
  const maxLoad = Math.max(8, ...load.map((w) => w.load));
  const monday = startOfWeek(today);

  const vms: PlanVM[] = live.map((p) => {
    const cls = classById.get(p.classId);
    return {
      id: p.id,
      className: cls?.name ?? "?",
      color: cls?.color ?? "#888",
      title: p.title,
      status: p.status as PlanVM["status"],
      planType: p.planType as PlanVM["planType"],
      collectDate: p.collectDate,
      handbackDate: p.handbackDate,
      collectLabel: pretty(p.collectDate),
      handbackLabel: pretty(p.handbackDate),
      collectPeriod: p.collectPeriod,
      handbackPeriod: p.handbackPeriod,
      dailyRate: p.dailyRate,
      totalBooks: p.totalBooks,
      markedCount: p.markedCount,
      late: p.late,
      locked: p.locked,
      weekKey: startOfWeek(p.collectDate),
      isToday: p.collectDate === today || p.handbackDate === today,
    };
  });

  return (
    <div className="space-y-6">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-pen">The engine</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Smart planner</h1>
          <p className="mt-1 max-w-2xl text-[0.88rem] leading-relaxed text-ink-soft">
            Every class gets a formative every <strong className="text-ink">{settings.minLessons}–{settings.maxLessons} lessons</strong>, never more than <strong className="text-ink">{settings.maxGapDays} days</strong> between hand-backs. Unexpected piles become fixed anchors and the flexible diary moves around them.
          </p>
        </div>
        <AdhocCollect
          classes={classes.map((c) => ({
            id: c.id,
            name: c.name,
            color: c.color,
            studentCount: c.studentCount,
            suggestedHandback: suggestAdhocHandback({ classId: c.id, slots, settings, today }).date,
          }))}
          today={today}
        />
      </header>

      {clashes.length === 0 ? (
        <div className="rise flex items-center gap-3 rounded-2xl border border-good/25 bg-good-soft px-5 py-4" style={{ animationDelay: "40ms" }}>
          <ShieldCheck size={20} className="shrink-0 text-good" />
          <p className="text-[0.85rem] font-medium text-good">No clashes in the diary — one pile at a time.</p>
        </div>
      ) : (
        <div className="rise rounded-2xl border border-warn/30 bg-warn-soft px-5 py-4" style={{ animationDelay: "40ms" }}>
          <p className="flex items-center gap-2 text-[0.85rem] font-bold text-warn">
            <TriangleAlert size={17} /> Expected crossover · {clashes.length} overlapping window{clashes.length === 1 ? "" : "s"}
          </p>
          <p className="mt-1 text-[0.78rem] text-warn">
            MarkFlow keeps piles separate where it can. A crossover can remain when a locked or unexpected pile makes overlap unavoidable; you can edit dates below if you want to override it.
          </p>
        </div>
      )}

      <section className="card rise p-5" style={{ animationDelay: "80ms" }}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-lg font-semibold text-ink">Workload by week</h2>
          <p className="text-[0.72rem] font-semibold text-ink-faint">expected books / day</p>
        </div>
        <div className="flex items-end gap-3">
          {load.map((w, i) => (
            <div key={w.start} className="flex flex-1 flex-col items-center gap-1.5">
              <p className="font-display text-[0.9rem] font-semibold text-ink">{w.load || ""}</p>
              <div className="flex h-24 w-full items-end overflow-hidden rounded-lg bg-ink/5">
                <div
                  className={`w-full rounded-lg transition-all duration-500 ${w.start === monday ? "bg-pen" : "bg-ink/25"}`}
                  style={{ height: `${Math.max(2, (w.load / maxLoad) * 100)}%` }}
                  title={`${w.load} books/day across ${w.plans} pile(s)`}
                />
              </div>
              <p className={`text-[0.62rem] font-bold uppercase tracking-wide ${w.start === monday ? "text-pen" : "text-ink-faint"}`}>
                {i === 0 ? "This wk" : prettyShort(w.start)}
              </p>
            </div>
          ))}
        </div>
      </section>

      <PlannerBoard plans={vms} today={today} />
    </div>
  );
}
