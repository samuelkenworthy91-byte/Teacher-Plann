"use client";

import { CalendarRange, Layers, Repeat2, Timer } from "lucide-react";
import { SettingsForm } from "@/components/settings-form";
import { DataManager } from "@/components/data-manager";
import { useBundle } from "@/lib/store";

export default function SettingsPage() {
  const bundle = useBundle();
  if (!bundle) return null;
  const { settings, profile } = bundle;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <header className="rise">
        <p className="text-[0.72rem] font-bold uppercase tracking-[0.16em] text-pen">Your rules</p>
        <h1 className="mt-1 font-display text-3xl font-semibold tracking-tight text-ink">Settings</h1>
        <p className="mt-1 max-w-lg text-[0.88rem] text-ink-soft">
          These four numbers drive the entire scheduler. Change them, then regenerate the plan.
        </p>
      </header>

      <div className="grid items-start gap-6 md:grid-cols-[1fr_1.15fr]">
        {/* Rule cards */}
        <div className="space-y-3">
          {[
            {
              icon: Repeat2,
              title: `Feedback every ${settings.minLessons}–${settings.maxLessons} lessons`,
              body: "Formative checks are spaced so classes are never marked back-to-back, and never forgotten.",
            },
            {
              icon: Timer,
              title: `${settings.maxGapDays} days maximum between hand-backs`,
              body: "The hard rule. Whatever the lesson count says, a class never waits longer than this.",
            },
            {
              icon: Layers,
              title: "One desk, one pile",
              body: "Collection-to-hand-back windows are staggered across classes. You never own two piles at once.",
            },
            {
              icon: CalendarRange,
              title: `${settings.windowDays} school days per pile`,
              body: "How long books stay with you. It's what turns 26 books into a calm 6-a-day.",
            },
          ].map((r, i) => (
            <div key={r.title} className="card card-hover rise flex gap-3.5 p-4" style={{ animationDelay: `${i * 60}ms` }}>
              <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-pen-soft text-pen">
                <r.icon size={16} />
              </span>
              <div>
                <p className="text-[0.86rem] font-bold leading-snug text-ink">{r.title}</p>
                <p className="mt-0.5 text-[0.76rem] leading-relaxed text-ink-soft">{r.body}</p>
              </div>
            </div>
          ))}
        </div>

        {/* The form */}
        <div className="card rise p-6" style={{ animationDelay: "120ms" }}>
          <SettingsForm settings={settings} name={profile.name} />
        </div>
      </div>

      <DataManager />
    </div>
  );
}
