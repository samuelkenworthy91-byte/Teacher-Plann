"use client";

import Link from "next/link";
import {
  ArrowDownToLine,
  ArrowUpFromLine,
  BookOpenCheck,
  CalendarPlus,
  CheckCheck,
  Flame,
  Sparkles,
  Timer,
  Users,
} from "lucide-react";
import { computeClassHealth, requiredToday } from "@/lib/engine";
import { addDays, pretty, prettyShort, schoolDaysInclusive, startOfWeek, todayStr, WEEKDAY_SHORT } from "@/lib/dates";
import { Dot, EmptyState, styleDelay } from "@/components/ui";
import { CollectHero, FocusPanel } from "@/components/dashboard-widgets";
import { DemoDataButton } from "@/components/demo-data-button";
import { useBundle } from "@/lib/store";

export default function DashboardPage() {
  const bundle = useBundle();
  if (!bundle) return null;
  const { classes, slots, plans, entries, settings, today } = bundle;

  /* ---------- onboarding ---------- */
  if (classes.length === 0) {
    return (
      <div className="rise mx-auto max-w-2xl pt-6">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-pen">Getting started</p>
        <h1 className="mt-2 font-display text-4xl font-semibold tracking-tight text-ink">
          Let's build your <span className="squiggle">marking rhythm</span>
        </h1>
        <p className="mt-3 text-[0.95rem] leading-relaxed text-ink-soft">
          Three quick steps and MarkFlow starts telling you what to collect, how much to mark each
          day, and when to hand it back.
        </p>
        <div className="mt-8 grid gap-4 sm:grid-cols-3">
          {[
            { n: "1", icon: Users, title: "Add your classes", body: "Names, year groups and class sizes.", href: "/classes", cta: "Add a class" },
            { n: "2", icon: CalendarPlus, title: "Snap & tap your timetable", body: "Upload the photo once, then tap the grid to match it.", href: "/timetable", cta: "Open timetable" },
            { n: "3", icon: Sparkles, title: "Generate the plan", body: "We schedule every formative so piles never collide.", href: "/planner", cta: "Open planner" },
          ].map((s) => (
            <Link key={s.n} href={s.href} className="card card-hover group block p-5">
              <span className="grid h-9 w-9 place-items-center rounded-xl bg-pen-soft text-pen">
                <s.icon size={17} />
              </span>
              <p className="mt-3 font-display text-[1.05rem] font-semibold text-ink">{s.title}</p>
              <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-soft">{s.body}</p>
              <p className="mt-3 text-[0.78rem] font-bold text-pen">{s.cta} →</p>
            </Link>
          ))}
        </div>
        <div className="mt-8 rounded-2xl border border-dashed border-line-strong bg-white/60 px-5 py-4 text-center">
          <p className="text-[0.82rem] text-ink-soft">
            Want to see it working first? Load a full demo timetable — you can wipe it any time from
            Settings.
          </p>
          <div className="mt-3 flex justify-center">
            <DemoDataButton />
          </div>
        </div>
      </div>
    );
  }

  /* ---------- focus computation ---------- */
  const classById = new Map(classes.map((c) => [c.id, c]));
  const marking = plans.filter((p) => p.status === "marking" && p.totalBooks - p.markedCount > 0);
  const collectDue = plans
    .filter((p) => p.status === "scheduled" && p.collectDate <= today)
    .sort((a, b) => a.collectDate.localeCompare(b.collectDate));

  const focus = marking[0] ?? null;
  const focusClass = focus ? classById.get(focus.classId) : null;

  /* ---------- stats ---------- */
  const weekStart = startOfWeek(today);
  const markedThisWeek = entries
    .filter((e) => e.date >= weekStart && e.count > 0)
    .reduce((s, e) => s + e.count, 0);
  const livePlans = plans.filter((p) => p.status !== "returned");
  const nextHandback = [...livePlans].sort((a, b) => a.handbackDate.localeCompare(b.handbackDate))[0];
  const health = classes.map((c) => computeClassHealth(c, slots, plans, settings, today));
  const onTrack = health.filter((h) => h.status === "fresh" || h.status === "ok").length;
  const plannedDays = livePlans.filter((p) => p.status === "scheduled").length;

  /* ---------- this week strip ---------- */
  const weekDays = Array.from({ length: 5 }, (_, i) => addDays(weekStart, i));
  const weekEvents = weekDays.map((d) => ({
    date: d,
    isToday: d === today,
    events: livePlans
      .filter((p) => p.collectDate === d || p.handbackDate === d)
      .map((p) => ({
        type: p.collectDate === d ? ("collect" as const) : ("handback" as const),
        className: classById.get(p.classId)?.name ?? "?",
        color: classById.get(p.classId)?.color ?? "#888",
        period: p.collectDate === d ? p.collectPeriod : p.handbackPeriod,
        status: p.status,
      })),
  }));

  /* ---------- recent activity ---------- */
  const planById = new Map(plans.map((p) => [p.id, p]));
  const recent = entries.filter((e) => e.count > 0).slice(0, 8);

  const STAT_CARDS = [
    {
      icon: BookOpenCheck,
      label: "Marked this week",
      value: `${markedThisWeek}`,
      sub: markedThisWeek === 1 ? "book" : "books",
    },
    {
      icon: Timer,
      label: "Next hand-back",
      value: nextHandback ? prettyShort(nextHandback.handbackDate) : "—",
      sub: nextHandback ? classById.get(nextHandback.classId)?.name ?? "" : "nothing booked",
    },
    {
      icon: CheckCheck,
      label: "Classes covered",
      value: `${onTrack}/${classes.length}`,
      sub: "inside the 2-week rule",
    },
    {
      icon: Flame,
      label: "Cycles booked",
      value: `${plannedDays}`,
      sub: "in your diary",
    },
  ];

  return (
    <div className="space-y-8">
      {/* Header */}
      <header className="rise flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-display text-[2.1rem] font-semibold leading-tight tracking-tight text-ink">
            {focus && focusClass
              ? `Today it's ${focusClass.name}.`
              : collectDue.length > 0
                ? `${classById.get(collectDue[0].classId)?.name} is due today.`
                : "All clear today."}
          </h1>
          <p className="mt-1 max-w-xl text-[0.88rem] leading-relaxed text-ink-soft">
            {focus
              ? `Stay above the red line and ${focusClass?.name}'s books go back on ${pretty(
                  focus.handbackDate,
                )} — then the next class is already queued.`
              : collectDue.length > 0
                ? "Grab the books in the lesson, start tonight, and the plan takes care of the rest."
                : "No active marking pile. The diary below shows what's coming up next."}
          </p>
        </div>
        <Link href="/planner" className="btn btn-ink">
          <Sparkles size={15} /> Smart planner
        </Link>
      </header>

      {/* Focus hero */}
      <section className="rise" style={styleDelay(1)}>
        {focus && focusClass ? (
          <FocusPanel
            planId={focus.id}
            className={focusClass.name}
            color={focusClass.color}
            title={focus.title}
            handbackLabel={pretty(focus.handbackDate)}
            totalBooks={focus.totalBooks}
            markedCount={focus.markedCount}
            requiredNow={requiredToday(focus, today)}
            daysLeft={schoolDaysInclusive(today, focus.handbackDate)}
            doneToday={entries
              .filter((e) => e.planId === focus.id && e.date === today)
              .reduce((s, e) => s + e.count, 0)}
          />
        ) : collectDue.length > 0 ? (
          <CollectHero
            items={collectDue.map((p) => ({
              planId: p.id,
              className: classById.get(p.classId)?.name ?? "?",
              color: classById.get(p.classId)?.color ?? "#888",
              period: p.collectPeriod,
              dailyRate: p.dailyRate,
              handbackLabel: pretty(p.handbackDate),
            }))}
          />
        ) : (
          <div className="card flex flex-wrap items-center gap-5 p-6">
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-good-soft text-good">
              <CheckCheck size={22} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-lg font-semibold text-ink">No pile on your desk</p>
              <p className="text-sm text-ink-soft">
                Nothing collected right now. Your next collection appears here the moment it's due.
              </p>
            </div>
          </div>
        )}
      </section>

      {/* Stats */}
      <section className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {STAT_CARDS.map((s, i) => (
          <div key={s.label} className="card card-hover rise p-4.5 p-5" style={styleDelay(2 + i)}>
            <div className="flex items-center justify-between">
              <p className="text-[0.68rem] font-bold uppercase tracking-[0.12em] text-ink-faint">{s.label}</p>
              <s.icon size={15} className="text-ink-faint" />
            </div>
            <p className="mt-2 font-display text-[1.7rem] font-semibold leading-none text-ink">
              {s.value}
            </p>
            <p className="mt-1 text-[0.75rem] text-ink-soft">{s.sub}</p>
          </div>
        ))}
      </section>

      <div className="grid gap-6 lg:grid-cols-[1.6fr_1fr]">
        {/* This week */}
        <section className="card rise p-5" style={styleDelay(6)}>
          <div className="mb-4 flex items-center justify-between">
            <h2 className="font-display text-lg font-semibold text-ink">This week</h2>
            <div className="flex items-center gap-4 text-[0.7rem] font-semibold text-ink-soft">
              <span className="flex items-center gap-1.5">
                <ArrowDownToLine size={12} className="text-pen" /> collect
              </span>
              <span className="flex items-center gap-1.5">
                <ArrowUpFromLine size={12} className="text-good" /> hand back
              </span>
            </div>
          </div>
          <div className="grid grid-cols-5 gap-2">
            {weekEvents.map((d, di) => (
              <div
                key={d.date}
                className={`min-h-[110px] rounded-xl border p-2 ${
                  d.isToday ? "border-pen/50 bg-pen-soft/50" : "border-line bg-white/60"
                }`}
              >
                <p className={`text-[0.68rem] font-bold uppercase tracking-wide ${d.isToday ? "text-pen" : "text-ink-faint"}`}>
                  {WEEKDAY_SHORT[di]}
                </p>
                <p className={`font-display text-[0.95rem] font-semibold ${d.isToday ? "text-pen" : "text-ink"}`}>
                  {Number(d.date.slice(8, 10))}
                </p>
                <div className="mt-1.5 space-y-1">
                  {d.events.map((ev, i) => (
                    <div
                      key={i}
                      className="flex items-center gap-1 rounded-md bg-white px-1.5 py-1 text-[0.62rem] font-semibold shadow-sm ring-1 ring-line"
                      title={`${ev.type === "collect" ? "Collect" : "Hand back"} ${ev.className}${ev.period ? ` · P${ev.period}` : ""}`}
                    >
                      <Dot color={ev.color} size={6} />
                      <span className="truncate">{ev.className}</span>
                      {ev.type === "collect" ? (
                        <ArrowDownToLine size={9} className="ml-auto shrink-0 text-pen" />
                      ) : (
                        <ArrowUpFromLine size={9} className="ml-auto shrink-0 text-good" />
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* Recent activity */}
        <section className="card rise p-5" style={styleDelay(7)}>
          <h2 className="mb-4 font-display text-lg font-semibold text-ink">Recent marking</h2>
          {recent.length === 0 ? (
            <EmptyState
              icon={BookOpenCheck}
              title="Nothing logged yet"
              body="Once you start ticking off books, your recent sessions will show up here."
            />
          ) : (
            <ul className="space-y-2.5">
              {recent.map((e) => {
                const plan = planById.get(e.planId);
                const cls = plan ? classById.get(plan.classId) : null;
                return (
                  <li key={e.id} className="flex items-center gap-3 text-sm">
                    <span
                      className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-[0.7rem] font-bold text-white"
                      style={{ background: cls?.color ?? "#888" }}
                    >
                      +{e.count}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-semibold text-ink">{cls?.name ?? "Class"}</p>
                      <p className="text-[0.72rem] text-ink-faint">{pretty(e.date)}</p>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      </div>

      {/* Class health */}
      <section className="rise" style={styleDelay(8)}>
        <div className="mb-4 flex items-end justify-between">
          <div>
            <h2 className="font-display text-lg font-semibold text-ink">Feedback radar</h2>
            <p className="text-[0.8rem] text-ink-soft">
              Every class, measured against your {settings.minLessons}–{settings.maxLessons} lesson /{" "}
              {settings.maxGapDays}-day rules.
            </p>
          </div>
          <Link href="/classes" className="btn btn-ghost !py-2 text-[0.75rem]">
            Manage classes
          </Link>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {health.map((h) => {
            const cls = classById.get(h.classId)!;
            const tone =
              h.status === "overdue"
                ? "bg-bad-soft text-bad"
                : h.status === "due"
                  ? "bg-warn-soft text-warn"
                  : h.status === "fresh"
                    ? "bg-good-soft text-good"
                    : "bg-ink/5 text-ink-soft";
            const label =
              h.status === "overdue" ? "Overdue" : h.status === "due" ? "Due soon" : h.status === "fresh" ? "Covered" : "Building";
            return (
              <div key={h.classId} className="card card-hover p-4">
                <div className="flex items-center gap-2.5">
                  <span className="h-9 w-1.5 rounded-full" style={{ background: cls.color }} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-[0.9rem] font-bold text-ink">{cls.name}</p>
                    <p className="text-[0.7rem] text-ink-faint">{cls.yearGroup}</p>
                  </div>
                  <span className={`chip !border-0 ${tone}`}>{label}</span>
                </div>
                <div className="mt-3 flex items-center justify-between text-[0.72rem] text-ink-soft">
                  <span>
                    <strong className="text-ink">{h.lessonsSince}</strong> lessons ·{" "}
                    <strong className="text-ink">{h.daysSince}</strong>d since feedback
                  </span>
                </div>
                {h.nextPlanned ? (
                  <p className="mt-1.5 text-[0.72rem] font-medium text-ink-faint">
                    {h.nextPlanned.status === "marking"
                      ? `On your desk now`
                      : `Collects ${prettyShort(h.nextPlanned.collectDate)}`}
                  </p>
                ) : (
                  <p className="mt-1.5 text-[0.72rem] font-medium text-warn">No cycle booked — run the planner</p>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
