"use client";

import { useState, useTransition, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { CalendarOff, Plus, Trash2 } from "lucide-react";
import {
  addUnavailableDatesAction,
  removeUnavailableDateAction,
} from "@/actions/unavailable";
import { pretty } from "@/lib/dates";
import { Spinner } from "@/components/ui";

export type ProtectedDayVM = { id: number; date: string; reason: string };

export function ProtectedDaysManager({
  days,
  today,
}: {
  days: ProtectedDayVM[];
  today: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [from, setFrom] = useState(today);
  const [to, setTo] = useState(today);
  const [reason, setReason] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  function addDays(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    const formData = new FormData();
    formData.set("from", from);
    formData.set("to", to);
    formData.set("reason", reason.trim());
    startTransition(async () => {
      const result = await addUnavailableDatesAction(formData);
      if (!result.ok) {
        setError(result.error ?? "Could not protect those days.");
        return;
      }
      const count = result.count ?? 0;
      setMessage(
        count === 0
          ? "Those working days were already protected. Your diary has still been refreshed."
          : `${count} working day${count === 1 ? "" : "s"} protected. Your diary has been refreshed.`,
      );
      setReason("");
      router.refresh();
    });
  }

  function removeDay(id: number) {
    setError(null);
    setMessage(null);
    startTransition(async () => {
      const result = await removeUnavailableDateAction(id);
      if (!result.ok) {
        setError(result.error ?? "Could not remove that protected day.");
        return;
      }
      router.refresh();
    });
  }

  const upcoming = days.filter((day) => day.date >= today);
  const past = days.length - upcoming.length;

  return (
    <section className="card rise p-6" style={{ animationDelay: "180ms" }}>
      <div className="flex items-start gap-3">
        <span className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warn-soft text-warn">
          <CalendarOff size={18} />
        </span>
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">
            Protected days
          </h2>
          <p className="mt-0.5 text-[0.78rem] leading-relaxed text-ink-soft">
            Block holidays, days you do not work, or days you will not mark. The
            planner skips them for collections and hand-backs, and they do not
            count toward a marking target.
          </p>
        </div>
      </div>

      <form
        onSubmit={addDays}
        className="mt-5 grid gap-3 sm:grid-cols-[1fr_1fr_1.3fr_auto]"
      >
        <div>
          <label className="label" htmlFor="protected-from">
            From
          </label>
          <input
            id="protected-from"
            type="date"
            className="input"
            value={from}
            onChange={(event) => {
              setFrom(event.target.value);
              if (to < event.target.value) setTo(event.target.value);
            }}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="protected-to">
            To
          </label>
          <input
            id="protected-to"
            type="date"
            className="input"
            min={from}
            value={to}
            onChange={(event) => setTo(event.target.value)}
            required
          />
        </div>
        <div>
          <label className="label" htmlFor="protected-reason">
            Note <span className="normal-case tracking-normal">(optional)</span>
          </label>
          <input
            id="protected-reason"
            className="input"
            maxLength={120}
            placeholder="e.g. Half term, PPA, not working"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
          />
        </div>
        <button
          type="submit"
          className="btn btn-ink self-end"
          disabled={pending || !from || !to}
        >
          {pending ? <Spinner /> : <Plus size={15} />}
          Block days
        </button>
      </form>

      {error ? (
        <p className="mt-3 text-[0.78rem] font-medium text-bad">{error}</p>
      ) : null}
      {message ? (
        <p className="mt-3 text-[0.78rem] font-medium text-good">{message}</p>
      ) : null}

      <div className="mt-5 border-t border-line pt-4">
        <div className="mb-2 flex items-center justify-between gap-3">
          <p className="text-[0.7rem] font-bold uppercase tracking-[0.12em] text-ink-faint">
            Upcoming protected days
          </p>
          <p className="text-[0.7rem] text-ink-faint">
            Weekends are always skipped
          </p>
        </div>
        {upcoming.length === 0 ? (
          <p className="rounded-xl border border-dashed border-line-strong px-4 py-4 text-center text-[0.78rem] text-ink-faint">
            No protected weekdays yet. Add a day or date range above when your
            routine changes.
          </p>
        ) : (
          <ul className="max-h-56 space-y-1.5 overflow-y-auto pr-1">
            {upcoming.map((day) => (
              <li
                key={day.id}
                className="flex items-center gap-3 rounded-lg bg-cream/70 px-3 py-2 text-[0.8rem]"
              >
                <span className="font-semibold text-ink">
                  {pretty(day.date)}
                </span>
                <span className="min-w-0 flex-1 truncate text-ink-soft">
                  {day.reason || "No marking"}
                </span>
                <button
                  type="button"
                  className="btn btn-quiet !p-1.5 hover:!text-bad"
                  disabled={pending}
                  title={`Remove ${pretty(day.date)} from protected days`}
                  onClick={() => removeDay(day.id)}
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        )}
        {past > 0 ? (
          <p className="mt-2 text-[0.7rem] text-ink-faint">
            {past} past protected day{past === 1 ? "" : "s"} kept in your
            record.
          </p>
        ) : null}
      </div>
    </section>
  );
}
