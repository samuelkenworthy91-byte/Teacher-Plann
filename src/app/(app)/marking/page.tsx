import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Archive, ArrowDownToLine, History, PenLine } from "lucide-react";
import { getCurrentUser } from "@/lib/auth";
import { getBundle } from "@/lib/queries";
import { computeDeferHandback, requiredToday, suggestAdhocHandback } from "@/lib/engine";
import { pretty, prettyShort, schoolDaysInclusive } from "@/lib/dates";
import { Dot, EmptyState } from "@/components/ui";
import { FocusPanel } from "@/components/dashboard-widgets";
import { AdhocCollect, DeferButton, RowActions, TaskCreator } from "@/components/marking-widgets";

export const metadata: Metadata = { title: "Marking" };
export const dynamic = "force-dynamic";

export default async function MarkingPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  const { classes, slots, plans, entries, settings, today } = await getBundle(user.id);

  const classById = new Map(classes.map((c) => [c.id, c]));
  const desk = plans
    .filter((p) => p.status === "marking")
    .sort((a, b) => a.handbackDate.localeCompare(b.handbackDate));
  const upcoming = plans
    .filter((p) => p.status === "scheduled")
    .sort((a, b) => a.collectDate.localeCompare(b.collectDate));
  const history = plans
    .filter((p) => p.status === "returned")
    .sort((a, b) => (b.returnedAt ?? "").localeCompare(a.returnedAt ?? ""))
    .slice(0, 10);

  return (
    <div className="space-y-8">
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-pen">The desk</p>
          <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Marking</h1>
          <p className="mt-1 max-w-xl text-[0.88rem] text-ink-soft">
            One pile at a time. Log books as you go — the daily minimum always reflects what&apos;s
            genuinely left.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
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
          <TaskCreator
            classes={classes.map((c) => ({ id: c.id, name: c.name, color: c.color, studentCount: c.studentCount }))}
            today={today}
          />
        </div>
      </header>

      {/* On the desk */}
      <section className="space-y-4">
        {desk.length === 0 ? (
          <div className="rise" style={{ animationDelay: "60ms" }}>
            <EmptyState
              icon={PenLine}
              title="Nothing on your desk"
              body="When a scheduled collection day arrives — or you create a deadline task — the pile lands here with its daily pace."
              action={
                <Link href="/planner" className="btn btn-ghost">
                  <ArrowDownToLine size={14} /> See what&apos;s due
                </Link>
              }
            />
          </div>
        ) : (
          desk.map((p, i) => {
            const cls = classById.get(p.classId);
            return (
              <div key={p.id} className="rise" style={{ animationDelay: `${60 + i * 60}ms` }}>
                <FocusPanel
                  planId={p.id}
                  className={cls?.name ?? "?"}
                  color={cls?.color ?? "#888"}
                  title={p.title}
                  handbackLabel={pretty(p.handbackDate)}
                  nextHandbackLabel={pretty(computeDeferHandback({ plan: p, slots, today }).handbackDate)}
                  deferredCount={p.deferredCount}
                  totalBooks={p.totalBooks}
                  markedCount={p.markedCount}
                  requiredNow={requiredToday(p, today)}
                  daysLeft={schoolDaysInclusive(today, p.handbackDate)}
                  doneToday={entries
                    .filter((e) => e.planId === p.id && e.date === today)
                    .reduce((s, e) => s + e.count, 0)}
                />
              </div>
            );
          })
        )}
      </section>

      <div className="grid items-start gap-6 lg:grid-cols-2">
        {/* Upcoming */}
        <section className="card rise p-5" style={{ animationDelay: "140ms" }}>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <ArrowDownToLine size={17} className="text-pen" /> Coming up
          </h2>
          {upcoming.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[0.82rem] text-ink-faint">
              No collections scheduled. Run the{" "}
              <Link href="/planner" className="font-semibold text-pen hover:underline">
                smart planner
              </Link>
              .
            </p>
          ) : (
            <ul className="space-y-2.5">
              {upcoming.map((p) => {
                const cls = classById.get(p.classId);
                const overdue = p.collectDate < today;
                return (
                  <li
                    key={p.id}
                    className={`flex flex-wrap items-center gap-3 rounded-xl border px-3.5 py-3 ${
                      p.collectDate === today
                        ? "border-pen/40 bg-pen-soft/50"
                        : overdue
                          ? "border-bad/30 bg-bad-soft/40"
                          : "border-line bg-white/70"
                    }`}
                  >
                    <Dot color={cls?.color ?? "#888"} size={10} />
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.86rem] font-bold text-ink">{cls?.name}</p>
                      <p className="text-[0.72rem] text-ink-soft">
                        {p.title} · {p.totalBooks} books · ≥{p.dailyRate}/day
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      {p.collectDate <= today ? (
                        <DeferButton planId={p.id} kind="collect" label="Move to next lesson" />
                      ) : null}
                      <p className="text-right text-[0.74rem] font-semibold text-ink">
                        {p.collectDate === today ? "Today" : prettyShort(p.collectDate)}
                        {p.collectPeriod ? <span className="text-ink-faint"> · P{p.collectPeriod}</span> : null}
                      </p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        {/* History */}
        <section className="card rise p-5" style={{ animationDelay: "180ms" }}>
          <h2 className="mb-4 flex items-center gap-2 font-display text-lg font-semibold text-ink">
            <History size={17} className="text-ink-faint" /> Handed back
          </h2>
          {history.length === 0 ? (
            <p className="rounded-xl border border-dashed border-line-strong px-4 py-6 text-center text-[0.82rem] text-ink-faint">
              Completed cycles will pile up here (nicely, for once).
            </p>
          ) : (
            <ul className="space-y-2.5">
              {history.map((p) => {
                const cls = classById.get(p.classId);
                return (
                  <li key={p.id} className="flex flex-wrap items-center gap-3 rounded-xl border border-line bg-white/70 px-3.5 py-3">
                    <span className="grid h-8 w-8 place-items-center rounded-lg bg-good-soft text-good">
                      <Archive size={14} />
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-[0.86rem] font-bold text-ink">{cls?.name}</p>
                      <p className="text-[0.72rem] text-ink-soft">
                        {p.title} · {p.totalBooks} books · back {p.returnedAt ? prettyShort(p.returnedAt) : "—"}
                      </p>
                    </div>
                    <RowActions planId={p.id} />
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
