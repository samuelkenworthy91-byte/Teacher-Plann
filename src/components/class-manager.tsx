"use client";

import { useOptimistic, useState, useTransition, type FormEvent } from "react";
import { CalendarDays, Pencil, Plus, Trash2, TriangleAlert, Users } from "lucide-react";
import { createClassAction, deleteClassAction, updateClassAction } from "@/actions/classes";
import { Dot, EmptyState, Modal, Spinner } from "@/components/ui";

export type ClassVM = {
  id: number;
  name: string;
  subject: string;
  yearGroup: string;
  studentCount: number;
  color: string;
  lessonsPerWeek: number;
  nextLabel: string | null;
  healthLabel: string;
  healthTone: "fresh" | "ok" | "due" | "overdue";
};

const COLORS = ["#D94F26", "#2563EB", "#0D9488", "#7C3AED", "#DB2777", "#CA8A04", "#059669", "#475569"];
const YEARS = ["Year 7", "Year 8", "Year 9", "Year 10", "Year 11", "Year 12", "Year 13"];

type Draft = {
  id?: number;
  name: string;
  yearGroup: string;
  studentCount: string;
  color: string;
};

const emptyDraft: Draft = { name: "", yearGroup: "Year 9", studentCount: "30", color: COLORS[0] };

type Op =
  | { kind: "add"; item: ClassVM }
  | { kind: "update"; item: ClassVM }
  | { kind: "delete"; id: number };

export function ClassManager({ classes }: { classes: ClassVM[] }) {
  const [pending, startTransition] = useTransition();
  const [draft, setDraft] = useState<Draft | null>(null);
  const [deleting, setDeleting] = useState<ClassVM | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [list, apply] = useOptimistic<ClassVM[], Op>(classes, (state, op) => {
    switch (op.kind) {
      case "add":
        return [...state, op.item].sort((a, b) => a.name.localeCompare(b.name));
      case "update":
        return state.map((c) => (c.id === op.item.id ? op.item : c));
      case "delete":
        return state.filter((c) => c.id !== op.id);
    }
  });

  function submit(e: FormEvent) {
    e.preventDefault();
    if (!draft) return;
    setError(null);
    const fd = new FormData();
    if (draft.id) fd.set("id", String(draft.id));
    fd.set("name", draft.name.trim());
    fd.set("yearGroup", draft.yearGroup);
    fd.set("studentCount", draft.studentCount);
    fd.set("color", draft.color);

    const vm: ClassVM = {
      id: draft.id ?? -Date.now(),
      name: draft.name.trim(),
      subject: "English",
      yearGroup: draft.yearGroup,
      studentCount: parseInt(draft.studentCount, 10) || 30,
      color: draft.color,
      lessonsPerWeek: 0,
      nextLabel: null,
      healthLabel: "Building",
      healthTone: "ok",
    };

    startTransition(async () => {
      apply(draft.id ? { kind: "update", item: vm } : { kind: "add", item: vm });
      const res = draft.id ? await updateClassAction(fd) : await createClassAction(fd);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
      } else {
        setDraft(null);
      }
    });
  }

  const toneClass: Record<ClassVM["healthTone"], string> = {
    overdue: "bg-bad-soft text-bad",
    due: "bg-warn-soft text-warn",
    fresh: "bg-good-soft text-good",
    ok: "bg-ink/5 text-ink-soft",
  };

  return (
    <div className="rise">
      <div className="mb-4 flex items-center justify-between">
        <p className="text-[0.85rem] text-ink-soft">
          <strong className="text-ink">{list.length}</strong> class{list.length === 1 ? "" : "es"} on your load
        </p>
        <button type="button" className="btn btn-pen" onClick={() => setDraft(emptyDraft)}>
          <Plus size={15} /> Add class
        </button>
      </div>

      {list.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No classes yet"
          body="Add your first English class — its size powers the daily marking targets everywhere else in MarkFlow."
          action={
            <button type="button" className="btn btn-pen" onClick={() => setDraft(emptyDraft)}>
              <Plus size={15} /> Add your first class
            </button>
          }
        />
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {list.map((c, i) => (
            <article
              key={c.id}
              className="card card-hover rise group relative overflow-hidden p-5"
              style={{ animationDelay: `${i * 50}ms` }}
            >
              <span
                className="absolute inset-x-0 top-0 h-1.5"
                style={{ background: `linear-gradient(90deg, ${c.color}, ${c.color}66)` }}
              />
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <h3 className="font-display text-[1.3rem] font-semibold tracking-tight text-ink">
                    {c.name}
                  </h3>
                  <p className="text-[0.78rem] text-ink-soft">{c.yearGroup || "—"}</p>
                </div>
                <span className={`chip !border-0 ${toneClass[c.healthTone]}`}>{c.healthLabel}</span>
              </div>

              <div className="mt-4 grid grid-cols-3 gap-2 text-center">
                {[
                  { n: c.studentCount, l: "students" },
                  { n: c.lessonsPerWeek, l: "lessons/wk" },
                  { n: c.studentCount && c.lessonsPerWeek ? Math.ceil(c.studentCount / 5) : "—", l: "≈ /day pace" },
                ].map((s) => (
                  <div key={s.l} className="rounded-xl bg-cream/70 px-2 py-2.5">
                    <p className="font-display text-[1.05rem] font-semibold leading-none text-ink">{s.n}</p>
                    <p className="mt-1 text-[0.62rem] font-semibold uppercase tracking-wide text-ink-faint">{s.l}</p>
                  </div>
                ))}
              </div>

              <div className="mt-4 flex items-center justify-between border-t border-line pt-3.5">
                <p className="flex min-w-0 items-center gap-1.5 pr-2 text-[0.74rem] font-medium text-ink-soft">
                  <CalendarDays size={13} className="shrink-0 text-ink-faint" />
                  <span className="truncate">{c.nextLabel ?? "No cycle booked"}</span>
                </p>
                <div className="flex shrink-0 gap-1 opacity-100 transition-opacity lg:opacity-0 lg:group-hover:opacity-100 lg:group-focus-within:opacity-100">
                  <button
                    type="button"
                    className="btn btn-quiet !p-2.5"
                    title="Edit class"
                    aria-label={`Edit ${c.name}`}
                    onClick={() =>
                      setDraft({
                        id: c.id,
                        name: c.name,
                        yearGroup: c.yearGroup || "Year 9",
                        studentCount: String(c.studentCount),
                        color: c.color,
                      })
                    }
                  >
                    <Pencil size={15} />
                  </button>
                  <button
                    type="button"
                    className="btn btn-quiet !p-2.5 hover:!text-bad"
                    title="Delete class"
                    aria-label={`Delete ${c.name}`}
                    onClick={() => setDeleting(c)}
                  >
                    <Trash2 size={15} />
                  </button>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}

      {/* Create / edit modal */}
      <Modal
        open={draft !== null}
        onClose={() => setDraft(null)}
        title={draft?.id ? "Edit class" : "Add a class"}
        subtitle="All classes are English. Class size sets your daily marking minimums."
      >
        {draft ? (
          <form onSubmit={submit} className="space-y-4">
            {error ? (
              <p className="pop flex items-center gap-2 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
                <TriangleAlert size={15} /> {error}
              </p>
            ) : null}
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2 sm:col-span-1">
                <label className="label" htmlFor="cf-name">Class name</label>
                <input
                  id="cf-name"
                  className="input"
                  placeholder="e.g. 9A"
                  value={draft.name}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  required
                  minLength={2}
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label" htmlFor="cf-year">Year group</label>
                <select
                  id="cf-year"
                  className="select"
                  value={draft.yearGroup}
                  onChange={(e) => setDraft({ ...draft, yearGroup: e.target.value })}
                >
                  {YEARS.map((y) => (
                    <option key={y}>{y}</option>
                  ))}
                </select>
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="label" htmlFor="cf-count">Students</label>
                <input
                  id="cf-count"
                  className="input"
                  type="number"
                  min={1}
                  max={60}
                  value={draft.studentCount}
                  onChange={(e) => setDraft({ ...draft, studentCount: e.target.value })}
                  required
                />
              </div>
            </div>
            <div>
              <span className="label">Colour</span>
              <div className="flex flex-wrap gap-2">
                {COLORS.map((col) => (
                  <button
                    key={col}
                    type="button"
                    onClick={() => setDraft({ ...draft, color: col })}
                    className="h-8 w-8 rounded-full transition-transform"
                    style={{
                      background: col,
                      transform: draft.color === col ? "scale(1.15)" : undefined,
                      boxShadow: draft.color === col ? `0 0 0 3px ${col}44` : undefined,
                    }}
                    aria-label={`Colour ${col}`}
                  />
                ))}
              </div>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" className="btn btn-ghost" onClick={() => setDraft(null)}>
                Cancel
              </button>
              <button type="submit" className="btn btn-ink" disabled={pending}>
                {pending ? <Spinner /> : <Dot color="currentColor" size={6} />}
                {draft.id ? "Save changes" : "Add class"}
              </button>
            </div>
          </form>
        ) : null}
      </Modal>

      {/* Delete modal */}
      <Modal
        open={deleting !== null}
        onClose={() => setDeleting(null)}
        title={`Delete ${deleting?.name}?`}
        subtitle="Its timetable slots and marking cycles will be removed too. This cannot be undone."
      >
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-ghost" onClick={() => setDeleting(null)}>
            Keep it
          </button>
          <button
            type="button"
            className="btn btn-danger"
            disabled={pending}
            onClick={() => {
              if (!deleting) return;
              startTransition(async () => {
                apply({ kind: "delete", id: deleting.id });
                setDeleting(null);
                await deleteClassAction(deleting.id);
              });
            }}
          >
            {pending ? <Spinner /> : <Trash2 size={14} />}
            Delete class
          </button>
        </div>
      </Modal>
    </div>
  );
}
