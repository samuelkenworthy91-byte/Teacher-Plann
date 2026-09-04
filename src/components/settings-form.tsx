"use client";

import { useState, useTransition, type FormEvent } from "react";
import { CheckCircle2, Save } from "lucide-react";
import { saveSettingsAction } from "@/actions/settings";
import type { SettingsRow } from "@/db/schema";
import { Spinner } from "@/components/ui";

export function SettingsForm({
  settings,
  email,
  name,
}: {
  settings: SettingsRow;
  email: string;
  name: string;
}) {
  const [pending, startTransition] = useTransition();
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function submit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaved(false);
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await saveSettingsAction(fd);
      if (!res.ok) setError(res.error ?? "Could not save.");
      else {
        setSaved(true);
        setTimeout(() => setSaved(false), 3000);
      }
    });
  }

  const field = (
    id: string,
    label: string,
    hint: string,
    value: number,
    min: number,
    max: number,
  ) => (
    <div>
      <label className="label" htmlFor={id}>
        {label}
      </label>
      <input
        id={id}
        name={id}
        type="number"
        className="input"
        defaultValue={value}
        min={min}
        max={max}
        required
      />
      <p className="mt-1 text-[0.7rem] text-ink-faint">{hint}</p>
    </div>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <div className="grid grid-cols-2 gap-4">
        {field("minLessons", "Min lessons between checks", "Earliest a class earns a formative.", settings.minLessons, 1, 20)}
        {field("maxLessons", "Max lessons between checks", "Never stretch a class beyond this.", settings.maxLessons, 2, 30)}
        {field("maxGapDays", "Max days between hand-backs", "Your two-week promise, in days.", settings.maxGapDays, 7, 28)}
        {field("windowDays", "School days per pile", "Collect → hand back turnaround.", settings.windowDays, 2, 10)}
      </div>

      <hr className="divider" />

      <div className="grid grid-cols-2 gap-4">
        <div>
          <span className="label">Name</span>
          <p className="rounded-lg bg-cream/70 px-3 py-2.5 text-[0.85rem] font-medium text-ink">{name}</p>
        </div>
        <div>
          <span className="label">Email</span>
          <p className="truncate rounded-lg bg-cream/70 px-3 py-2.5 text-[0.85rem] font-medium text-ink">{email}</p>
        </div>
      </div>

      {error ? <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{error}</p> : null}

      <div className="flex items-center justify-end gap-3">
        {saved ? (
          <span className="pop flex items-center gap-1.5 text-[0.8rem] font-bold text-good">
            <CheckCircle2 size={15} /> Saved
          </span>
        ) : null}
        <button type="submit" className="btn btn-ink" disabled={pending}>
          {pending ? <Spinner /> : <Save size={14} />}
          Save rules
        </button>
      </div>
    </form>
  );
}
