import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Camera, Sparkles, Users } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getBundle } from "@/lib/queries";
import { Dot, EmptyState } from "@/components/ui";
import { PhotoPanel, TimetableEditor } from "@/components/timetable-editor";

export const metadata: Metadata = { title: "Timetable" };
export const dynamic = "force-dynamic";

const PERIODS = [1, 2, 3, 4, 5, 6];

export default async function TimetablePage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { classes, slots, photo } = await getBundle(user.id);

  if (classes.length === 0) {
    return (
      <div className="rise mx-auto max-w-xl pt-10">
        <EmptyState
          icon={Users}
          title="Add your classes first"
          body="Your timetable grid is filled by tapping classes into cells — create the classes, then come back."
          action={
            <Link href="/classes" className="btn btn-pen">
              Go to My Classes
            </Link>
          }
        />
      </div>
    );
  }

  const perClass = classes.map((c) => ({
    ...c,
    lessons: slots.filter((s) => s.classId === c.id).length,
  }));

  return (
    <div className="space-y-6">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-pen">Set once</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">
            Your timetable
          </h1>
          <p className="mt-1 max-w-xl text-[0.88rem] leading-relaxed text-ink-soft">
            Snap the photo once as your reference, then tap each cell to drop the class in. The
            planner counts lessons between these cells to time every formative.
          </p>
        </div>
        <Link href="/planner" className="btn btn-ink">
          <Sparkles size={15} /> Generate plan
        </Link>
      </header>

      <div className="grid items-start gap-6 lg:grid-cols-[1.7fr_1fr]">
        {/* The grid */}
        <section className="card rise overflow-hidden p-4 sm:p-5" style={{ animationDelay: "60ms" }}>
          <TimetableEditor
            classes={classes.map((c) => ({ id: c.id, name: c.name, color: c.color }))}
            slots={slots.map((s) => ({ dayOfWeek: s.dayOfWeek, period: s.period, classId: s.classId }))}
            periods={PERIODS}
          />
        </section>

        {/* Sidebar */}
        <aside className="space-y-4">
          <div className="card rise p-5" style={{ animationDelay: "120ms" }}>
            <div className="flex items-center gap-2">
              <Camera size={15} className="text-pen" />
              <h2 className="font-display text-base font-semibold text-ink">Your photo</h2>
            </div>
            <p className="mt-1 text-[0.78rem] leading-relaxed text-ink-soft">
              Keep the original photo here as your source of truth while you fill the grid.
            </p>
            <div className="mt-3">
              <PhotoPanel initialPhoto={photo} />
            </div>
          </div>

          <div className="card rise p-5" style={{ animationDelay: "180ms" }}>
            <h2 className="font-display text-base font-semibold text-ink">Lessons per class</h2>
            <ul className="mt-3 space-y-2">
              {perClass.map((c) => (
                <li key={c.id} className="flex items-center gap-2 text-[0.82rem]">
                  <Dot color={c.color} />
                  <span className="flex-1 font-semibold text-ink">{c.name}</span>
                  <span className={`text-[0.74rem] font-medium ${c.lessons === 0 ? "text-warn" : "text-ink-soft"}`}>
                    {c.lessons === 0 ? "not timetabled" : `${c.lessons}×/week`}
                  </span>
                </li>
              ))}
            </ul>
            {perClass.some((c) => c.lessons === 0) ? (
              <p className="mt-3 rounded-lg bg-warn-soft px-3 py-2 text-[0.74rem] font-medium leading-relaxed text-warn">
                Classes without lessons can&apos;t be planned — tap them into the grid.
              </p>
            ) : null}
          </div>
        </aside>
      </div>
    </div>
  );
}
