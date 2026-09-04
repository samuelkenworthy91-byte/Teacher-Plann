"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { BookDown, Calculator, CalendarOff, ClipboardCheck, Plus, RotateCcw, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import {
  createAdhocAction,
  createTaskAction,
  deferCollectAction,
  deferHandbackAction,
  deletePlanAction,
  reopenPlanAction,
} from "@/actions/plans";
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
                Pick a deadline and I&apos;ll work out the daily minimum.
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
/* Off-schedule pile — "I've taken something in that wasn't planned"   */
/* ------------------------------------------------------------------ */

type AdhocClass = { id: number; name: string; color: string; studentCount: number; suggestedHandback: string };

export function AdhocCollect({ classes, today }: { classes: AdhocClass[]; today: string }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<string | null>(null);
  const [classId, setClassId] = useState<number | "">(classes[0]?.id ?? "");
  const [title, setTitle] = useState("");
  const [total, setTotal] = useState("");
  const [handback, setHandback] = useState("");

  const cls = classes.find((c) => c.id === classId);
  const effectiveTotal = parseInt(total, 10) > 0 ? parseInt(total, 10) : cls?.studentCount ?? 0;
  const effHandback = handback || cls?.suggestedHandback || today;
  const pace =
    effectiveTotal > 0 && effHandback >= today ? dailyRateFor(effectiveTotal, today, effHandback) : null;

  function submit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    const fd = new FormData();
    fd.set("classId", String(classId));
    fd.set("title", title.trim());
    if (total) fd.set("totalBooks", total);
    if (handback) fd.set("handbackDate", handback);
    startTransition(async () => {
      const res = await createAdhocAction(fd);
      if (!res.ok) setError(res.error ?? "Could not add the pile.");
      else {
        setOpen(false);
        setDone(
          `On your desk now — hand back ${effHandback === today ? "as soon as you can" : `by ${effHandback}`}. The rest of the diary has been rebalanced around it.`,
        );
        setTitle("");
        setTotal("");
        setHandback("");
        router.refresh();
        setTimeout(() => setDone(null), 6000);
      }
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {done ? (
          <span className="pop rounded-full bg-ink px-3.5 py-2 text-[0.72rem] font-semibold text-cream">
            {done}
          </span>
        ) : null}
        <button
          type="button"
          className="btn btn-pen"
          onClick={() => setOpen(true)}
          disabled={classes.length === 0}
        >
          <BookDown size={15} /> Taken books in
        </button>
      </div>

      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="I've taken something in today"
        subtitle="Assessments, mocks, surprise piles — tell me what landed on your desk and I'll work the rest of the diary around it."
      >
        <form onSubmit={submit} className="space-y-4">
          {error ? (
            <p className="pop rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{error}</p>
          ) : null}
          <div>
            <label className="label" htmlFor="ac-class">Which class?</label>
            <select
              id="ac-class"
              className="select"
              value={classId}
              onChange={(e) => {
                setClassId(Number(e.target.value));
                setHandback(""); // re-pick the suggestion for this class
              }}
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
            <label className="label" htmlFor="ac-title">What is it?</label>
            <input
              id="ac-title"
              className="input"
              placeholder="e.g. End-of-topic assessment"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <p className="mt-1 text-[0.7rem] text-ink-faint">Leave blank and it&apos;s just &quot;taken in today&quot;.</p>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="ac-total">Books (optional)</label>
              <input
                id="ac-total"
                type="number"
                className="input"
                min={1}
                placeholder={String(cls?.studentCount ?? 30)}
                value={total}
                onChange={(e) => setTotal(e.target.value)}
              />
            </div>
            <div>
              <label className="label" htmlFor="ac-handback">Hand back by</label>
              <input
                id="ac-handback"
                type="date"
                className="input"
                value={handback || (cls?.suggestedHandback ?? "")}
                min={today}
                onChange={(e) => setHandback(e.target.value)}
              />
            </div>
          </div>

          <div className="flex items-start gap-3 rounded-xl bg-cream/80 px-4 py-3.5">
            <ClipboardCheck size={17} className="mt-0.5 shrink-0 text-pen" />
            {pace !== null && cls ? (
              <p className="text-[0.84rem] leading-snug text-ink">
                <strong>{effectiveTotal}</strong> books for{" "}
                <strong style={{ color: cls.color }}>{cls.name}</strong> → mark at least{" "}
                <strong className="font-display text-[1.15rem] text-pen">{pace}</strong>/day. Everything
                else in the diary shifts around this pile; overlap only if it can&apos;t be avoided.
              </p>
            ) : (
              <p className="text-[0.84rem] text-ink-soft">
                Pick a class and I&apos;ll suggest a hand-back date on its next lesson.
              </p>
            )}
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>
              Cancel
            </button>
            <button type="submit" className="btn btn-pen" disabled={pending || !classId}>
              {pending ? <Spinner /> : <BookDown size={15} />}
              It&apos;s on my desk
            </button>
          </div>
        </form>
      </Modal>
    </>
  );
}

/* ------------------------------------------------------------------ */
/* "Can't do it today" compact button (diary rows, coming-up lists)    */
/* ------------------------------------------------------------------ */

export function DeferButton({
  planId,
  kind,
  label,
}: {
  planId: number;
  kind: "collect" | "handback";
  label: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);

  if (msg) {
    return (
      <span className="pop text-[0.7rem] font-semibold text-warn" title="The diary has been rebalanced around the move.">
        {msg}
      </span>
    );
  }

  if (confirming) {
    return (
      <span className="pop flex items-center gap-1.5">
        <span className="text-[0.7rem] font-semibold text-warn">{label}?</span>
        <button
          type="button"
          className="btn btn-pen !px-2.5 !py-1.5 !text-[0.68rem]"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              const res =
                kind === "collect" ? await deferCollectAction(planId) : await deferHandbackAction(planId);
              if (res.ok) {
                setMsg(kind === "collect" ? "Moved to next lesson" : "Hand-back pushed");
                router.refresh();
              } else {
                setMsg(res.error ?? "Couldn't move it");
              }
            })
          }
        >
          {pending ? <Spinner /> : null} Yes
        </button>
        <button
          type="button"
          className="btn btn-ghost !px-2.5 !py-1.5 !text-[0.68rem]"
          onClick={() => setConfirming(false)}
        >
          No
        </button>
      </span>
    );
  }

  return (
    <button
      type="button"
      className="btn btn-quiet !px-2 !py-1.5 !text-[0.68rem]"
      title={kind === "collect" ? "Can't collect today — slide to this class's next lesson" : "Can't keep the pace — push the hand-back to the next lesson"}
      onClick={() => setConfirming(true)}
      disabled={pending}
    >
      <CalendarOff size={11} /> Can&apos;t today
    </button>
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
