"use client";

import { useOptimistic, useState, useTransition } from "react";
import { ArrowDownToLine, CalendarOff, CheckCheck, Minus, PartyPopper, Plus } from "lucide-react";
import {
  collectPlanAction,
  deferCollectAction,
  deferHandbackAction,
  logBooksAction,
  returnPlanAction,
} from "@/actions/plans";
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
  /** Where the hand-back would move if the teacher says "can't keep the pace". */
  nextHandbackLabel?: string;
  /** Times this pile has already been moved with "can't do it today". */
  deferredCount?: number;
  totalBooks: number;
  markedCount: number;
  requiredNow: number;
  doneToday: number;
  daysLeft: number;
}) {
  const [pending, startTransition] = useTransition();
  const [confirmReturn, setConfirmReturn] = useState(false);
  const [cantMark, setCantMark] = useState(false);
  const [custom, setCustom] = useState("");

  const [{ marked, loggedToday }, bump] = useOptimistic(
    { marked: props.markedCount, loggedToday: props.doneToday },
    (state, delta: number) => ({
      marked: Math.max(0, Math.min(props.totalBooks, state.marked + delta)),
      loggedToday: Math.max(0, state.loggedToday + delta),
    }),
  );

  const [returned, setReturned] = useOptimistic(false);

  const progress = props.totalBooks === 0 ? 1 : marked / props.totalBooks;
  const needMoreToday = Math.max(0, props.requiredNow - loggedToday);
  const onPace = needMoreToday === 0;

  const log = (delta: number) => {
    if (delta === 0) return;
    startTransition(async () => {
      bump(delta);
      await logBooksAction(props.planId, delta);
    });
  };

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
            The clock resets. {props.className}&apos;s next formative will be scheduled inside your 4–8
            lesson window.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div
      className="card overflow-hidden"
      style={{ background: `linear-gradient(135deg, ${props.color}14, #fffdf8 45%)` }}
    >
      <div className="grid gap-6 p-6 sm:p-7 md:grid-cols-[auto_1fr]">
        {/* Ring */}
        <div className="flex items-center justify-center">
          <ProgressRing size={150} stroke={13} progress={progress} color={props.color}>
            <div className="text-center">
              <p className="font-display text-[2rem] font-semibold leading-none text-ink">{marked}</p>
              <p className="mt-1 text-[0.68rem] font-bold uppercase tracking-widest text-ink-faint">
                of {props.totalBooks}
              </p>
            </div>
          </ProgressRing>
        </div>

        {/* Body */}
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className="chip !border-0 text-white"
              style={{ background: props.color }}
            >
              {props.className}
            </span>
            <span className="chip">{props.title}</span>
            {props.deferredCount && props.deferredCount > 0 ? (
              <span className="chip !border-0 !bg-warn-soft !text-warn" title="Moved because you couldn't do it on the day">
                <CalendarOff size={10} /> moved {props.deferredCount}×
              </span>
            ) : null}
            <span className={`chip ${onPace ? "!bg-good-soft !text-good !border-0" : "!bg-pen-soft !text-pen !border-0"}`}>
              {onPace ? "Today's pace hit" : `Mark ${needMoreToday}+ today`}
            </span>
          </div>

          <p className="mt-3 font-display text-[1.55rem] font-semibold leading-tight text-ink">
            {needMoreToday > 0 ? (
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
            Hands back on <strong className="text-ink">{props.handbackLabel}</strong> ·{" "}
            {props.daysLeft} marking day{props.daysLeft === 1 ? "" : "s"} left · pace ≈{" "}
            {props.requiredNow}/day · {loggedToday} logged today.
          </p>

          {/* Log controls */}
          <div className="mt-5 flex flex-wrap items-center gap-2">
            {[1, 5, 10].map((n) => (
              <button
                key={n}
                type="button"
                disabled={pending || marked >= props.totalBooks}
                onClick={() => log(n)}
                className="btn btn-ink"
              >
                <Plus size={13} /> {n}
              </button>
            ))}
            <button
              type="button"
              disabled={pending || marked <= 0}
              onClick={() => log(-1)}
              className="btn btn-ghost"
              title="Undo one"
            >
              <Minus size={13} />
            </button>
            <form
              className="flex items-center gap-1.5"
              onSubmit={(e) => {
                e.preventDefault();
                const n = parseInt(custom, 10);
                if (Number.isFinite(n) && n > 0) {
                  log(n);
                  setCustom("");
                }
              }}
            >
              <input
                value={custom}
                onChange={(e) => setCustom(e.target.value.replace(/[^0-9]/g, ""))}
                placeholder="n"
                className="input !w-16 !px-2 text-center"
                inputMode="numeric"
              />
              <button type="submit" className="btn btn-ghost" disabled={pending || !custom}>
                Log
              </button>
            </form>
            {pending ? <Spinner className="text-ink-faint" /> : null}
          </div>
        </div>
      </div>

      {/* Footer: hand back */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-line bg-white/60 px-6 py-3.5 sm:px-7">
        <p className="text-[0.75rem] text-ink-soft">
          {props.totalBooks - marked === 0
            ? "Every book marked — ready to go back."
            : `${props.totalBooks - marked} still to mark before the lesson.`}
        </p>
        <div className="flex flex-wrap items-center gap-2">
          {cantMark && props.nextHandbackLabel ? (
            <>
              <span className="text-[0.78rem] font-semibold text-ink">
                No time? Hand back {props.nextHandbackLabel} instead?
              </span>
              <button
                type="button"
                className="btn btn-pen"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => void (await deferHandbackAction(props.planId)))
                }
              >
                {pending ? <Spinner /> : <CalendarOff size={14} />} Yes, move it
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setCantMark(false)}>
                Keep {props.handbackLabel}
              </button>
            </>
          ) : (
            <button
              type="button"
              className="btn btn-quiet !text-[0.74rem]"
              onClick={() => setCantMark(true)}
              title="Can't keep the pace? Push the hand-back to this class's next lesson and rebalance the diary."
            >
              <CalendarOff size={13} /> Can&apos;t keep the pace today?
            </button>
          )}
          {confirmReturn ? (
            <span className="flex items-center gap-2">
              <span className="text-[0.78rem] font-semibold text-ink">Handed back in class?</span>
              <button
                type="button"
                className="btn btn-pen"
                disabled={pending}
                onClick={() =>
                  startTransition(async () => {
                    setReturned(true);
                    await returnPlanAction(props.planId);
                  })
                }
              >
                <CheckCheck size={14} /> Yes, done
              </button>
              <button type="button" className="btn btn-ghost" onClick={() => setConfirmReturn(false)}>
                Not yet
              </button>
            </span>
          ) : (
            <button type="button" className="btn btn-ghost" onClick={() => setConfirmReturn(true)}>
              <CheckCheck size={14} /> Mark as handed back
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Collect today hero                                                  */
/* ------------------------------------------------------------------ */

export function CollectHero({
  items,
}: {
  items: {
    planId: number;
    className: string;
    color: string;
    period: number | null;
    dailyRate: number;
    handbackLabel: string;
    /** "Fri 20 Jun" — where collection moves if the teacher can't do it today. */
    nextCollectLabel?: string;
  }[];
}) {
  const [pending, startTransition] = useTransition();
  const [collected, markCollected] = useOptimistic<Record<number, boolean>, number>(
    {},
    (state, id) => ({ ...state, [id]: true }),
  );
  const [cantCollect, setCantCollect] = useState<number | null>(null);

  return (
    <div className="space-y-3">
      {items.map((it) =>
        collected[it.planId] ? null : (
          <div key={it.planId} className="card pop flex flex-wrap items-center gap-4 p-5 sm:p-6">
            <span
              className="grid h-12 w-12 place-items-center rounded-2xl text-white"
              style={{ background: it.color }}
            >
              <ArrowDownToLine size={20} />
            </span>
            <div className="min-w-0 flex-1">
              <p className="font-display text-[1.25rem] font-semibold leading-snug text-ink">
                Collect {it.className}&apos;s books today{it.period ? ` — Period ${it.period}` : ""}
              </p>
              <p className="mt-0.5 text-[0.82rem] text-ink-soft">
                Then mark ≈ <strong className="text-ink">{it.dailyRate}/day</strong> and hand them
                back on {it.handbackLabel}.
              </p>
              {cantCollect === it.planId ? (
                <span className="pop mt-2 flex flex-wrap items-center gap-2 rounded-xl bg-warn-soft px-3 py-2">
                  <span className="text-[0.78rem] font-semibold text-warn">
                    Can&apos;t get them today? I&apos;ll slide it to {it.className}&apos;s next
                    lesson{it.nextCollectLabel ? ` (${it.nextCollectLabel})` : ""} and rebalance
                    everything else.
                  </span>
                  <button
                    type="button"
                    className="btn btn-pen !py-2"
                    disabled={pending}
                    onClick={() =>
                      startTransition(async () => {
                        markCollected(it.planId);
                        await deferCollectAction(it.planId);
                      })
                    }
                  >
                    {pending ? <Spinner /> : <CalendarOff size={13} />} Move it
                  </button>
                  <button
                    type="button"
                    className="btn btn-ghost !py-2"
                    onClick={() => setCantCollect(null)}
                  >
                    Keep today
                  </button>
                </span>
              ) : (
                <button
                  type="button"
                  className="btn btn-quiet -ml-2 !py-1.5 !text-[0.72rem]"
                  onClick={() => setCantCollect(it.planId)}
                >
                  <CalendarOff size={12} /> I can&apos;t collect today
                </button>
              )}
            </div>
            <button
              type="button"
              className="btn btn-pen"
              disabled={pending}
              onClick={() =>
                startTransition(async () => {
                  markCollected(it.planId);
                  await collectPlanAction(it.planId);
                })
              }
            >
              {pending ? <Spinner /> : null}
              Books collected
            </button>
          </div>
        ),
      )}
    </div>
  );
}

/** Small inline chip used elsewhere. */
export function ClassChip({ name, color }: { name: string; color: string }) {
  return (
    <span className="chip !border-0 font-bold" style={{ background: `${color}1c`, color }}>
      <Dot color={color} size={7} />
      {name}
    </span>
  );
}
