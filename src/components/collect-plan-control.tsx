"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { ArrowDownToLine, CalendarDays } from "lucide-react";
import { collectPlanAction } from "@/actions/plans";
import { dailyRateFor } from "@/lib/engine";
import { Modal, Spinner } from "@/components/ui";

export function CollectPlanControl({
  planId,
  className,
  plannedHandbackDate,
  totalBooks,
  today,
  label = "Books collected",
  compact = false,
}: {
  planId: number;
  className: string;
  plannedHandbackDate: string;
  totalBooks: number;
  today: string;
  label?: string;
  compact?: boolean;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [handbackDate, setHandbackDate] = useState(
    plannedHandbackDate < today ? today : plannedHandbackDate,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  const effectiveDate = handbackDate < today ? today : handbackDate;
  const pace = dailyRateFor(totalBooks, today, effectiveDate);

  function openDialog() {
    setHandbackDate(plannedHandbackDate < today ? today : plannedHandbackDate);
    setError(null);
    setOpen(true);
  }

  function confirmCollection() {
    setError(null);
    startTransition(async () => {
      const result = await collectPlanAction(planId, handbackDate);
      if (!result.ok) {
        setError(result.error ?? "Could not record this collection.");
        return;
      }
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <>
      <button
        type="button"
        className={
          compact
            ? "btn btn-quiet !py-2 !text-[0.74rem] !text-pen"
            : "btn btn-pen"
        }
        disabled={pending}
        onClick={openDialog}
      >
        {pending ? <Spinner /> : <ArrowDownToLine size={compact ? 13 : 14} />}
        {label}
      </button>

      <Modal
        open={open}
        onClose={() => !pending && setOpen(false)}
        title={`Collect ${className}`}
        subtitle="Recorded as collected today. Set the hand-back date that now works in real life."
      >
        <div className="space-y-4">
          {error ? (
            <p className="pop rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
              {error}
            </p>
          ) : null}
          <div>
            <label className="label" htmlFor={`collect-handback-${planId}`}>
              Hand back on
            </label>
            <input
              id={`collect-handback-${planId}`}
              type="date"
              className="input"
              min={today}
              value={handbackDate}
              onChange={(event) => setHandbackDate(event.target.value)}
              required
            />
          </div>
          <div className="flex gap-3 rounded-xl bg-cream/80 px-4 py-3.5">
            <CalendarDays size={17} className="mt-0.5 shrink-0 text-pen" />
            <p className="text-[0.82rem] leading-relaxed text-ink-soft">
              Mark at least{" "}
              <strong className="text-ink">
                {pace} book{pace === 1 ? "" : "s"} a day
              </strong>{" "}
              to hand back {totalBooks} books by this date. Your unlocked future
              tasks will move around this actual collection automatically.
            </p>
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              className="btn btn-ghost"
              disabled={pending}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="btn btn-pen"
              disabled={pending || !handbackDate || handbackDate < today}
              onClick={confirmCollection}
            >
              {pending ? <Spinner /> : <ArrowDownToLine size={14} />}
              Confirm collection
            </button>
          </div>
        </div>
      </Modal>
    </>
  );
}
