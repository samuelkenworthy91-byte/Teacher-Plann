"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { Calculator, Plus, RotateCcw, Trash2 } from "lucide-react";
import { createTaskAction, deletePlanAction, reopenPlanAction } from "@/actions/plans";
import { dailyRateFor } from "@/lib/engine";
import { Dot, Modal, Spinner } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Manual deadline task — "just tell me the daily minimum"             */
/* ------------------------------------------------------------------ */

type ClassLite = { id: number; name: string; color: string; studentCount: number };

export function TaskCreator({ classes, today }: { classes: ClassLite[]; today: string }) {
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [classId, setClassId] = useState<number | "">(classes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [deadline, setDeadline] = useState("");
  const [total, setTotal] = useState("");

  const cls = classes.find((c) => c.id === classId);
  const effectiveTotal = parseInt(total, 10) > 0 ? parseInt(total, 10) : cls?.studentCount ?? 0;
  const pace =
    deadline && effectiveTotal > 0
      ? dailyRateFor(effectiveTotal, today, deadline < today ? today : deadline)
      : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("classId", String(classId));
    fd.set("title", title.trim());
    fd.set("deadline", deadline);
    if (total) fd.set("totalBooks", total);
    startTransition(async () => {
      const res = await createTaskAction(fd);
      if (!res.ok) setError(res.error ?? "Could not create task.");
      else {
        setOpen(false);
        setTitle("");
        setDeadline("");
        setTotal("");
      }
    });
  }

  return (
    <>
      <button
        type="button"
        className="btn btn-ink"
        onClick={() => setOpen(true)}
        disabled={classes.length === 0}
      >
        <Plus size={15} /> Deadline task
      </button>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="Set a deadline, get a daily minimum"
        subtitle="For coursework, mocks, anything with a hard date. It joins the diary as a locked pile."
      >
        <form onSubmit={submit} className="space-y-4">
          {error ? (
            <p className="pop rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{error}</p>
          ) : null}
          <div>
            <label className="label" htmlFor="tc-class">Class</label>
            <select
              id="tc-class"
              className="select"
              value={classId}
              onChange={(e) => setClassId(Number(e.target.value))}
              required
            >
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} · {c.studentCount} students
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="tc-title">What is it?</label>
            <input
              id="tc-title"
              className="input"
              placeholder="e.g. End-of-unit assessment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="tc-deadline">Hand back by</label>
              <input
                id="tc-deadline"
                type="date"
                className="input"
                value={deadline}
                min={today}
                onChange={(e) => setDeadline(e.target.value)}
                required
              />
            </div>
            <div>
              <label className="label" htmlFor="tc-total">Books (optional)</label>
              <input
                id="tc-total"
                type="number"
                className="input"
                min={1}
                placeholder={String(cls?.studentCount ?? 30)}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-center gap-3 rounded-xl bg-cream/80 px-4 py-3.5">
            <Calculator size={17} className="shrink-0 text-pen" />
            {pace !== null && cls ? (
              <p className="text-[0.84rem] leading-snug text-ink">
                To return <strong>{effectiveTotal}</strong> books to{" "}
                <strong style={{ color: cls.color }}>{cls.name}</strong> by then, mark at least{" "}
                <strong className="font-display text-[1.15rem] text-pen">{pace}</strong> per school
                day.
              </p>
            ) : (
              <p className="text-[0.84rem] text-ink-soft">
                Pick a deadline and I'll work out the daily minimum.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-pen" disabled={pending || !deadline}>
              {pending ? <Spinner /> : <Dot color="currentColor" size={6} />}
              Add to my desk
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* History row actions                                                 */
/* ------------------------------------------------------------------ */

export function RowActions({ planId }: { planId: number }) {
  const [pending, startTransition] = useTransition();
  const [gone, setGone] = useOptimistic(false);
  if (gone) return null;
  return (
    <div className="flex items-center gap-1">
      <button
        type="button"
        className="btn btn-quiet !p-2"
        title="Oops — reopen this pile"
        disabled={pending}
        onClick={() => startTransition(async () => void (await reopenPlanAction(planId)))}
      >
        {pending ? <Spinner /> : <RotateCcw size={13} />}
      </button>
      <button
        type="button"
        className="btn btn-quiet !p-2 hover:!text-bad"
        title="Delete record"
        disabled={pending}
        onClick={() =>
          startTransition(async () => {
            setGone(true);
            await deletePlanAction(planId);
          })
        }
      >
        <Trash2 size={13} />
      </button>
    </div>
  );
}
