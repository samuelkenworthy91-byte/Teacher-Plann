"use client";

import { useState, useTransition, type FormEvent } from "react";
import { BookDown, CalendarOff, ClipboardCheck } from "lucide-react";
import { createAdhocAction, deferCollectAction, deferHandbackAction } from "@/actions/plans";
import { dailyRateFor } from "@/lib/engine";
import { Modal, Spinner } from "@/components/ui";

type AdhocClass = {
  id: number;
  name: string;
  color: string;
  studentCount: number;
  suggestedHandback: string;
};

export function AdhocCollect({ classes, today }: { classes: AdhocClass[]; today: string }) {
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
  const effectiveHandback = handback || cls?.suggestedHandback || today;
  const pace = effectiveTotal > 0 ? dailyRateFor(effectiveTotal, today, effectiveHandback) : null;

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
      if (!res.ok) {
        setError(res.error ?? "Could not add the pile.");
        return;
      }
      setOpen(false);
      setDone("Added to your desk — the flexible diary has been rebalanced.");
      setTitle("");
      setTotal("");
      setHandback("");
    });
  }

  return (
    <>
      <div className="flex flex-wrap items-center gap-2">
        {done ? <span className="chip !border-0 !bg-good-soft !text-good">{done}</span> : null}
        <button type="button" className="btn btn-pen" onClick={() => setOpen(true)} disabled={!classes.length}>
          <BookDown size={15} /> Taken books in
        </button>
      </div>
      <Modal
        open={open}
        onClose={() => setOpen(false)}
        title="I've taken something in today"
        subtitle="Assessments, mocks or surprise piles — MarkFlow will work the flexible diary around it."
      >
        <form onSubmit={submit} className="space-y-4">
          {error ? <p className="rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{error}</p> : null}
          <div>
            <label className="label" htmlFor="adhoc-class">Which class?</label>
            <select
              id="adhoc-class"
              className="select"
              value={classId}
              onChange={(e) => { setClassId(Number(e.target.value)); setHandback(""); }}
              required
            >
              {classes.map((c) => <option key={c.id} value={c.id}>{c.name} · {c.studentCount} students</option>)}
            </select>
          </div>
          <div>
            <label className="label" htmlFor="adhoc-title">What is it?</label>
            <input id="adhoc-title" className="input" placeholder="e.g. End-of-topic assessment" value={title} onChange={(e) => setTitle(e.target.value)} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="label" htmlFor="adhoc-total">Books</label>
              <input id="adhoc-total" type="number" min={1} className="input" placeholder={String(cls?.studentCount ?? 30)} value={total} onChange={(e) => setTotal(e.target.value)} />
            </div>
            <div>
              <label className="label" htmlFor="adhoc-handback">Hand back by</label>
              <input id="adhoc-handback" type="date" min={today} className="input" value={handback || cls?.suggestedHandback || ""} onChange={(e) => setHandback(e.target.value)} />
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-xl bg-cream/80 px-4 py-3.5">
            <ClipboardCheck size={17} className="mt-0.5 shrink-0 text-pen" />
            <p className="text-[0.84rem] leading-snug text-ink">
              {pace !== null && cls ? <><strong>{effectiveTotal}</strong> books for <strong style={{ color: cls.color }}>{cls.name}</strong> → at least <strong className="text-pen">{pace}/day</strong>.</> : "Pick a class and MarkFlow will suggest a hand-back date."}
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" className="btn btn-ghost" onClick={() => setOpen(false)}>Cancel</button>
            <button type="submit" className="btn btn-pen" disabled={pending || !classId}>{pending ? <Spinner /> : <BookDown size={15} />} It's on my desk</button>
          </div>
        </form>
      </Modal>
    </>
  );
}

export function DeferButton({
  planId,
  kind,
  label,
}: {
  planId: number;
  kind: "collect" | "handback";
  label?: string;
}) {
  const [pending, startTransition] = useTransition();
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  if (message) return <span className="text-[0.7rem] font-semibold text-warn">{message}</span>;
  if (confirming) {
    return (
      <span className="flex flex-wrap items-center gap-1.5">
        <span className="text-[0.7rem] font-semibold text-warn">{label ?? "Move it"}?</span>
        <button
          type="button"
          className="btn btn-pen !px-2.5 !py-1.5 !text-[0.68rem]"
          disabled={pending}
          onClick={() => startTransition(async () => {
            const res = kind === "collect" ? await deferCollectAction(planId) : await deferHandbackAction(planId);
            setMessage(res.ok ? (kind === "collect" ? "Moved to next lesson" : "Hand-back pushed") : (res.error ?? "Couldn't move it"));
          })}
        >
          {pending ? <Spinner /> : null} Yes
        </button>
        <button type="button" className="btn btn-ghost !px-2.5 !py-1.5 !text-[0.68rem]" onClick={() => setConfirming(false)}>No</button>
      </span>
    );
  }

  return (
    <button type="button" className="btn btn-quiet !px-2 !py-1.5 !text-[0.68rem]" onClick={() => setConfirming(true)}>
      <CalendarOff size={11} /> {kind === "collect" ? "Can't collect today" : "Can't keep the pace"}
    </button>
  );
}
