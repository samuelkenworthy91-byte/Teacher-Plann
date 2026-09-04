"use client";

import { useMemo, useOptimistic, useState, useTransition, type FormEvent } from "react";
import {
  ArrowRight,
  CalendarClock,
  Lock,
  LockOpen,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  TriangleAlert,
} from "lucide-react";
import {
  collectPlanAction,
  deletePlanAction,
  generatePlanAction,
  toggleLockAction,
  updatePlanAction,
} from "@/actions/plans";
import { Dot, EmptyState, Modal, Spinner } from "@/components/ui";

export type PlanVM = {
  id: number;
  className: string;
  color: string;
  title: string;
  status: "scheduled" | "marking";
  planType: "auto" | "manual";
  collectDate: string;
  handbackDate: string;
  collectLabel: string;
  handbackLabel: string;
  collectPeriod: number | null;
  handbackPeriod: number | null;
  dailyRate: number;
  totalBooks: number;
  markedCount: number;
  late: boolean;
  locked: boolean;
  weekKey: string;
  isToday: boolean;
};

export function PlannerBoard({ plans, today }: { plans: PlanVM[]; today: string }) {
  const [pending, startTransition] = useTransition();
  const [flash, setFlash] = useState<string | null>(null);
  const [editing, setEditing] = useState<PlanVM | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

  const [list, applyDelete] = useOptimistic<PlanVM[], number>(plans, (state, id) =>
    state.filter((p) => p.id !== id),
  );

  const groups = useMemo(() => {
    const m = new Map<string, PlanVM[]>();
    for (const p of list) {
      const arr = m.get(p.weekKey) ?? [];
      arr.push(p);
      m.set(p.weekKey, arr);
    }
    return [...m.entries()].sort(([a], [b]) => a.localeCompare(b));
  }, [list]);

  function regenerate() {
    startTransition(async () => {
      const res = await generatePlanAction();
      setFlash(
        res.ok
          ? res.count === 0
            ? "Diary already covers every class due a cycle."
            : `Scheduled ${res.count} formative cycle${res.count === 1 ? "" : "s"}.`
          : res.error ?? "Could not generate.",
      );
      setTimeout(() => setFlash(null), 4500);
    });
  }

  function saveEdit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    if (!editing) return;
    setFormError(null);
    const fd = new FormData(e.currentTarget);
    fd.set("id", String(editing.id));
    startTransition(async () => {
      const res = await updatePlanAction(fd);
      if (!res.ok) setFormError(res.error ?? "Could not save.");
      else setEditing(null);
    });
  }

  return (
    <section className="rise" style={{ animationDelay: "120ms" }}>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="font-display text-lg font-semibold text-ink">The diary</h2>
          <p className="text-[0.78rem] text-ink-soft">
            Collect the class, mark the daily minimum, hand back in the named lesson. Locked or
            edited entries survive regeneration.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {flash ? (
            <span className="pop rounded-full bg-ink px-3.5 py-2 text-[0.74rem] font-semibold text-cream">
              {flash}
            </span>
          ) : null}
          <button type="button" className="btn btn-pen" onClick={regenerate} disabled={pending}>
            {pending ? <Spinner /> : <RefreshCw size={14} />}
            {list.length === 0 ? "Generate my plan" : "Regenerate plan"}
          </button>
        </div>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Sparkles}
          title="Nothing scheduled yet"
          body="Hit generate and MarkFlow will lay out every upcoming formative — collect lessons, hand-back lessons and daily minimums — with zero pile collisions."
          action={
            <button type="button" className="btn btn-pen" onClick={regenerate} disabled={pending}>
              {pending ? <Spinner /> : <Sparkles size={15} />}
              Generate my plan
            </button>
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map(([week, items]) => (
            <div key={week}>
              <p className="mb-2 text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-faint">
                Week of {items[0]?.collectLabel ? new Date(week + "T00:00:00Z").toUTCString().slice(0, 16) : week}
              </p>
              <div className="space-y-2.5">
                {items.map((p) => (
                  <article
                    key={p.id}
                    className={`card pop flex flex-wrap items-center gap-x-4 gap-y-3 p-4 sm:px-5 ${
                      p.isToday ? "ring-2 ring-pen/40" : ""
                    }`}
                  >
                    <span className="hidden h-11 w-1.5 rounded-full sm:block" style={{ background: p.color }} />

                    <div className="min-w-[120px] flex-1">
                      <div className="flex items-center gap-2">
                        <p className="font-display text-[1.02rem] font-bold text-ink">{p.className}</p>
                        {p.planType === "manual" ? <span className="chip !py-1 !text-[0.62rem]">manual</span> : null}
                        {p.late ? (
                          <span className="chip !border-0 !bg-warn-soft !py-1 !text-[0.62rem] !text-warn">
                            <TriangleAlert size={10} /> tight
                          </span>
                        ) : null}
                      </div>
                      <p className="text-[0.72rem] text-ink-soft">
                        {p.title} · {p.totalBooks} books
                      </p>
                    </div>

                    <div className="flex items-center gap-2 text-[0.8rem] font-semibold text-ink">
                      <span className="flex items-center gap-1.5 rounded-lg bg-pen-soft px-2.5 py-1.5 text-pen">
                        <CalendarClock size={13} />
                        {p.collectLabel}
                        {p.collectPeriod ? <span className="opacity-70">P{p.collectPeriod}</span> : null}
                      </span>
                      <ArrowRight size={14} className="text-ink-faint" />
                      <span className="flex items-center gap-1.5 rounded-lg bg-good-soft px-2.5 py-1.5 text-good">
                        <Dot color="currentColor" size={6} />
                        {p.handbackLabel}
                        {p.handbackPeriod ? <span className="opacity-70">P{p.handbackPeriod}</span> : null}
                      </span>
                    </div>

                    <span className="chip !border-0 !bg-ink !py-1.5 !pl-2.5 !text-cream">
                      mark ≥ <strong className="px-0.5">{p.dailyRate}</strong>/day
                    </span>

                    {p.status === "marking" ? (
                      <span className="chip !border-0 !bg-pen !py-1.5 !text-white">
                        on desk · {p.markedCount}/{p.totalBooks}
                      </span>
                    ) : null}

                    <div className="ml-auto flex items-center gap-1">
                      {p.status === "scheduled" && p.collectDate <= today ? (
                        <button
                          type="button"
                          className="btn btn-quiet !py-2 !text-[0.74rem] !text-pen"
                          disabled={pending}
                          onClick={() => startTransition(async () => void (await collectPlanAction(p.id)))}
                        >
                          Collected
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="btn btn-quiet !p-2"
                        title={p.locked ? "Unlock (allow regeneration to move it)" : "Lock (keep these dates)"}
                        onClick={() => startTransition(async () => void (await toggleLockAction(p.id)))}
                      >
                        {p.locked ? <Lock size={14} className="text-pen" /> : <LockOpen size={14} />}
                      </button>
                      <button type="button" className="btn btn-quiet !p-2" title="Edit" onClick={() => setEditing(p)}>
                        <Pencil size={14} />
                      </button>
                      <button
                        type="button"
                        className="btn btn-quiet !p-2 hover:!text-bad"
                        title="Delete"
                        disabled={pending}
                        onClick={() =>
                          startTransition(async () => {
                            applyDelete(p.id);
                            await deletePlanAction(p.id);
                          })
                        }
                      >
                        <Trash2 size={14} />
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Edit modal */}
      <Modal
        open={editing !== null}
        onClose={() => setEditing(null)}
        title={`Edit — ${editing?.className}`}
        subtitle="Edited entries lock automatically. The daily pace recalculates itself."
      >
        {editing ? (
          <form onSubmit={saveEdit} className="space-y-4">
            {formError ? (
              <p className="pop rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">{formError}</p>
            ) : null}
            <div>
              <label className="label" htmlFor="ep-title">Task</label>
              <input id="ep-title" name="title" className="input" defaultValue={editing.title} required />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="label" htmlFor="ep-collect">Collect</label>
                <input
                  id="ep-collect"
                  name="collectDate"
                  type="date"
                  className="input"
                  defaultValue={editing.collectDate}
                  required
                />
              </div>
              <div>
                <label className="label" htmlFor="ep-hand">Hand back</label>
                <input
                  id="ep-hand"
                  name="handbackDate"
                  type="date"
                  className="input"
                  defaultValue={editing.handbackDate}
                  required
                />
              </div>
            </div>
            <div>
              <label className="label" htmlFor="ep-total">Books in the pile</label>
              <input
                id="ep-total"
                name="totalBooks"
                type="number"
                min={1}
                max={400}
                className="input"
                defaultValue={editing.totalBooks}
                required
              />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button type="button" className="btn btn-ghost" onClick={() => setEditing(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-ink" disabled={pending}>
                {pending ? <Spinner /> : null}
                Save
              </button>
            </div>
          </form>
        ) : null}
      </Modal>
    </section>
  );
}
