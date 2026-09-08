"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowDownToLine,
  CheckCheck,
  Minus,
  PartyPopper,
  Plus,
  Trash2,
  Undo2,
} from "lucide-react";
import {
  deletePlanAction,
  logBooksAction,
  returnPlanAction,
  undoLastMarkingAction,
} from "@/actions/plans";
import { CollectPlanControl } from "@/components/collect-plan-control";
import { Dot, ProgressRing, Spinner } from "@/components/ui";

/* ------------------------------------------------------------------ */
/* Today's focus — the active marking pile                             */
/* ------------------------------------------------------------------ */

export function FocusPanel(props: {
  planId: number;
  className: string;
  color: string;
  title: string;
  handbackLabel: string;
  totalBooks: number;
  markedCount: number;
  requiredNow: number;
  doneToday: number;
  daysLeft: number;
  isProtectedToday?: boolean;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [custom, setCustom] = useState("");
  const [returned, setReturned] = useState(false);
  const [deleted, setDeleted] = useState(false);

  const [{ marked, loggedToday }, bump] = useOptimistic(
    { marked: props.markedCount, loggedToday: props.doneToday },
    (state, delta: number) => ({
      marked: Math.max(0, Math.min(props.totalBooks, state.marked + delta)),
      loggedToday: Math.max(0, state.loggedToday + delta),
    }),
  );

  const progress = props.totalBooks === 0 ? 1 : marked / props.totalBooks;
  const needMoreToday = Math.max(0, props.requiredNow - loggedToday);
  const onPace = needMoreToday === 0;

  const log = (delta: number) => {
    if (delta === 0 || props.isProtectedToday) return;
    setActionError(null);
    startTransition(async () => {
      bump(delta);
      const result = await logBooksAction(props.planId, delta);
      if (!result.ok) {
        setActionError(result.error ?? "Could not log those books.");
        router.refresh();
      }
    });
  };

  function undoLastInput() {
    setActionError(null);
    startTransition(async () => {
      const result = await undoLastMarkingAction(props.planId);
      if (!result.ok) {
        setActionError(result.error ?? "Could not undo the last input.");
        return;
      }
      router.refresh();
    });
  }

  function handBack() {
    setActionError(null);
    startTransition(async () => {
      const result = await returnPlanAction(props.planId);
      if (!result.ok) {
        setActionError(result.error ?? "Could not record the hand-back.");
        return;
      }
      setReturned(true);
      router.refresh();
    });
  }

  function deleteTask() {
    setActionError(null);
    startTransition(async () => {
      const result = await deletePlanAction(props.planId);
      if (!result.ok) {
        setActionError(result.error ?? "Could not delete this task.");
        return;
      }
      setDeleted(true);
      router.refresh();
    });
  }

  if (returned) {
    return (
      <div className="card pop flex flex-wrap items-center gap-5 p-6 sm:p-7">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-good-soft text-good">
          <PartyPopper size={26} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold text-ink">
            {props.className} handed back — cycle complete
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            Today is saved as the actual hand-back date. The next formative is
            being planned from that date now.
          </p>
        </div>
      </div>
    );
  }

  if (deleted) {
    return (
      <div className="card pop flex flex-wrap items-center gap-5 p-6 sm:p-7">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-cream text-ink-soft">
          <Trash2 size={24} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="font-display text-xl font-semibold text-ink">
            Task deleted
          </p>
          <p className="mt-1 text-sm text-ink-soft">
            The freed-up time is being used to rework your flexible smart plan.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="card overflow-hidden"
      style={{
        background: `linear-gradient(135deg, ${props.color}14, #fffdf8 45%)`,
      }}
    >
      <div className="grid gap-6 p-6 sm:p-7 md:grid-cols-[auto_1fr]">
        <div className="flex items-center justify-center">
          <ProgressRing
            size={150}
            stroke={13}
            progress={progress}
            color={props.color}
          >
            <div className="text-center">
              <p className="font-display text-[2rem] font-semibold leading-none text-ink">
                {marked}
              </p>
              <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-widest text-ink-faint">
                of {props.totalBooks}
              </p>
            </div>
          </ProgressRing>
        </div>

        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="chip !border-0 text-white"
              style={{ background: props.color }}
            >
              {props.className}
            </span>
            <span className="chip">{props.title}</span>
            <span
              className={`chip ${
                onPace
                  ? "!border-0 !bg-good-soft !text-good"
                  : "!border-0 !bg-pen-soft !text-pen"
              }`}
            >
              {props.isProtectedToday
                ? "Protected day"
                : onPace
                  ? "Today's pace hit"
                  : `Mark ${needMoreToday}+ today`}
            </span>
          </div>

          <p className="mt-3 font-display text-[1.55rem] font-semibold leading-tight text-ink">
            {props.isProtectedToday ? (
              <>No marking scheduled today.</>
            ) : needMoreToday > 0 ? (
              <>
                Mark at least{" "}
                <span className="squiggle">
                  {needMoreToday} book{needMoreToday === 1 ? "" : "s"}
                </span>{" "}
                today.
              </>
            ) : (
              <>Today&apos;s minimum is done. Anything extra buys tomorrow.</>
            )}
          </p>
          <p className="mt-1.5 text-[0.82rem] leading-relaxed text-ink-soft">
            {props.isProtectedToday ? (
              <>This protected day is excluded from your marking pace.</>
            ) : (
              <>
                Hands back on{" "}
                <strong className="text-ink">{props.handbackLabel}</strong> ·{" "}
                {props.daysLeft} marking day{props.daysLeft === 1 ? "" : "s"}{" "}
                left · pace ≈ {props.requiredNow}/day · {loggedToday} logged
                today.
              </>
            )}
          </p>

          <div className="mt-5 flex flex-wrap items-center gap-2">
            {[1, 5, 10].map((count) => (
              <button
                key={count}
                type="button"
                disabled={
                  pending ||
                  props.isProtectedToday ||
                  marked >= props.totalBooks
                }
                onClick={() => log(count)}
                className="btn btn-ink"
              >
                <Plus size={13} /> {count}
              </button>
            ))}
            <button
              type="button"
              disabled={pending || props.isProtectedToday || marked <= 0}
              onClick={() => log(-1)}
              className="btn btn-ghost"
              title="Undo one"
            >
              <Minus size={13} />
            </button>
            <button
              type="button"
              disabled={pending}
              onClick={undoLastInput}
              className="btn btn-ghost"
              title="Remove the full most recent marking input, including a bulk entry"
            >
              <Undo2 size={13} /> Undo last input
            </button>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(event) => {
                event.preventDefault();
                const count = parseInt(custom, 10);
                if (Number.isFinite(count) && count > 0) {
                  log(count);
                  setCustom("");
                }
              }}
            >
              <input
                value={custom}
                onChange={(event) =>
                  setCustom(event.target.value.replace(/[^0-9]/g, ""))
                }
                placeholder="n"
                className="input !w-16 !px-2 text-center"
                inputMode="numeric"
              />
              <button
                type="submit"
                className="btn btn-ghost"
                disabled={pending || props.isProtectedToday || !custom}
              >
                Log
              </button>
            </form>
            {pending ? <Spinner className="text-ink-faint" /> : null}
          </div>
        </div>
      </div>

      <div className="border-t border-line bg-white/60 px-6 py-3.5 sm:px-7">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <p className="text-[0.75rem] text-ink-soft">
            {props.totalBooks - marked === 0
              ? "Every book marked — ready to go back."
              : `${props.totalBooks - marked} still to mark before the lesson.`}
          </p>
          {confirmReturn ? (
            <span className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-[0.78rem] font-semibold text-ink">
                Handed back today? Today&apos;s date will be saved.
              </span>
              <button
                type="button"
                className="btn btn-pen"
                disabled={pending}
                onClick={handBack}
              >
                {pending ? <Spinner /> : <CheckCheck size={14} />} Yes, done
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pending}
                onClick={() => setConfirmReturn(false)}
              >
                Not yet
              </button>
            </span>
          ) : confirmDelete ? (
            <span className="flex flex-wrap items-center justify-end gap-2">
              <span className="text-[0.78rem] font-semibold text-bad">
                Delete this task?
              </span>
              <button
                type="button"
                className="btn btn-pen !bg-bad"
                disabled={pending}
                onClick={deleteTask}
              >
                {pending ? <Spinner /> : <Trash2 size={14} />} Delete task
              </button>
              <button
                type="button"
                className="btn btn-ghost"
                disabled={pending}
                onClick={() => setConfirmDelete(false)}
              >
                Keep it
              </button>
            </span>
          ) : (
            <span className="flex items-center gap-1.5">
              <button
                type="button"
                className="btn btn-ghost"
                onClick={() => setConfirmReturn(true)}
              >
                <CheckCheck size={14} /> Mark as handed back
              </button>
              <button
                type="button"
                className="btn btn-quiet !p-2 hover:!text-bad"
                title="Delete task"
                onClick={() => setConfirmDelete(true)}
              >
                <Trash2 size={15} />
              </button>
            </span>
          )}
        </div>
        {actionError ? (
          <p className="mt-2 text-[0.76rem] font-medium text-bad">
            {actionError}
          </p>
        ) : null}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Collect today hero                                                  */
/* ------------------------------------------------------------------ */

export function CollectHero({
  items,
  today,
  unavailableDates = [],
}: {
  items: {
    planId: number;
    className: string;
    color: string;
    period: number | null;
    totalBooks: number;
    handbackDate: string;
    handbackLabel: string;
  }[];
  today: string;
  unavailableDates?: string[];
}) {
  return (
    <div className="space-y-3">
      {items.map((item) => (
        <div
          key={item.planId}
          className="card pop flex flex-wrap items-center gap-4 p-5 sm:p-6"
        >
          <span
            className="grid h-12 w-12 place-items-center rounded-2xl text-white"
            style={{ background: item.color }}
          >
            <ArrowDownToLine size={20} />
          </span>
          <div className="min-w-0 flex-1">
            <p className="font-display text-[1.25rem] font-semibold leading-snug text-ink">
              Collect {item.className}&apos;s books today
              {item.period ? ` — Period ${item.period}` : ""}
            </p>
            <p className="mt-0.5 text-[0.82rem] text-ink-soft">
              Choose a realistic hand-back date when you confirm. The current
              plan is {item.handbackLabel}.
            </p>
          </div>
          <CollectPlanControl
            planId={item.planId}
            className={item.className}
            plannedHandbackDate={item.handbackDate}
            totalBooks={item.totalBooks}
            today={today}
            unavailableDates={unavailableDates}
          />
        </div>
      ))}
    </div>
  );
}

/** Small inline chip used elsewhere. */
export function ClassChip({ name, color }: { name: string; color: string }) {
  return (
    <span
      className="chip !border-0 font-bold"
      style={{ background: `${color}1c`, color }}
    >
      <Dot color={color} size={7} />
      {name}
    </span>
  );
}
