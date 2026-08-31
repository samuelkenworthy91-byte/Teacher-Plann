"use client";

import { useOptimistic, useRef, useState, useTransition } from "react";
import { Check, Eraser, ImagePlus, RefreshCw, Trash2, X } from "lucide-react";
import { clearPhotoAction, savePhotoAction, setSlotAction } from "@/actions/timetable";
import { EmptyState, Spinner } from "@/components/ui";

type SlotVM = { dayOfWeek: number; period: number; classId: number };
type ClassLite = { id: number; name: string; color: string };

const DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri"];

export function TimetableEditor({
  classes,
  slots,
  periods,
}: {
  classes: ClassLite[];
  slots: SlotVM[];
  periods: number[];
}) {
  const [pending, startTransition] = useTransition();
  const [selected, setSelected] = useState<{ day: number; period: number } | null>(null);

  const [grid, apply] = useOptimistic<SlotVM[], { day: number; period: number; classId: number | null }>(
    slots,
    (state, op) => {
      const rest = state.filter((s) => !(s.dayOfWeek === op.day && s.period === op.period));
      return op.classId === null ? rest : [...rest, { dayOfWeek: op.day, period: op.period, classId: op.classId }];
    },
  );

  const byClass = new Map(classes.map((c) => [c.id, c]));
  const at = (day: number, period: number) =>
    grid.find((s) => s.dayOfWeek === day && s.period === period);

  function pick(day: number, period: number, classId: number | null) {
    startTransition(async () => {
      apply({ day, period, classId });
      setSelected(null);
      await setSlotAction(day, period, classId);
    });
  }

  return (
    <div>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[560px] border-separate" style={{ borderSpacing: 4 }}>
          <thead>
            <tr>
              <th className="w-10" />
              {DAYS.map((d) => (
                <th
                  key={d}
                  className="pb-1 text-center text-[0.68rem] font-bold uppercase tracking-[0.14em] text-ink-faint"
                >
                  {d}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {periods.map((p) => (
              <tr key={p}>
                <td className="pr-1 text-center text-[0.68rem] font-bold text-ink-faint">P{p}</td>
                {DAYS.map((_, di) => {
                  const day = di + 1;
                  const slot = at(day, p);
                  const cls = slot ? byClass.get(slot.classId) : null;
                  const isSel = selected?.day === day && selected?.period === p;
                  return (
                    <td key={day}>
                      <button
                        type="button"
                        onClick={() => setSelected(isSel ? null : { day, period: p })}
                        className={`group grid h-12 w-full place-items-center rounded-lg text-[0.7rem] font-bold transition-all ${
                          isSel ? "ring-2 ring-pen ring-offset-1" : ""
                        }`}
                        style={
                          cls
                            ? {
                                background: `${cls.color}1a`,
                                color: cls.color,
                                border: `1px solid ${cls.color}55`,
                              }
                            : {
                                border: "1.5px dashed rgba(33,29,23,0.16)",
                                color: "rgba(33,29,23,0.35)",
                              }
                        }
                        aria-label={`${DAYS[di]} P${p}${cls ? ` — ${cls.name}` : " — empty"}`}
                      >
                        {cls ? (
                          <span className="truncate px-1">{cls.name}</span>
                        ) : (
                          <span className="text-base opacity-0 transition-opacity group-hover:opacity-100">+</span>
                        )}
                      </button>
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Cell picker */}
      {selected ? (
        <div className="pop mt-4 rounded-xl border border-line bg-white p-3.5">
          <div className="mb-2.5 flex items-center justify-between">
            <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
              {DAYS[selected.day - 1]} · Period {selected.period} — who&apos;s here?
            </p>
            <button type="button" className="btn btn-quiet !p-1.5" onClick={() => setSelected(null)}>
              <X size={14} />
            </button>
          </div>
          <div className="flex flex-wrap gap-2">
            {classes.map((c) => {
              const current = at(selected.day, selected.period)?.classId === c.id;
              return (
                <button
                  key={c.id}
                  type="button"
                  disabled={pending}
                  onClick={() => pick(selected.day, selected.period, c.id)}
                  className="btn !py-2 !text-[0.76rem] text-white"
                  style={{ background: c.color, opacity: current ? 1 : 0.88 }}
                >
                  {current ? <Check size={13} /> : null}
                  {c.name}
                </button>
              );
            })}
            {at(selected.day, selected.period) ? (
              <button
                type="button"
                disabled={pending}
                onClick={() => pick(selected.day, selected.period, null)}
                className="btn btn-ghost !py-2 !text-[0.76rem]"
              >
                <Eraser size={13} /> Clear
              </button>
            ) : null}
            {pending ? <Spinner className="self-center text-ink-faint" /> : null}
          </div>
        </div>
      ) : (
        <p className="mt-3 text-center text-[0.72rem] text-ink-faint">
          Tap any cell to assign a class. This grid is the input for every scheduling decision.
        </p>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Photo reference                                                     */
/* ------------------------------------------------------------------ */

export function PhotoPanel({ initialPhoto }: { initialPhoto: string | null }) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(false);
  const [photo, setPhoto] = useOptimistic<string | null>(initialPhoto);
  const inputRef = useRef<HTMLInputElement>(null);

  async function fileToDataUrl(file: File): Promise<string> {
    // Downscale so Postgres happily holds it
    const bitmap = await createImageBitmap(file);
    const max = 1400;
    const scale = Math.min(1, max / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d")!;
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/jpeg", 0.82);
  }

  function onFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const dataUrl = await fileToDataUrl(file);
      setPhoto(dataUrl);
      const res = await savePhotoAction(dataUrl);
      if (!res.ok) setError(res.error ?? "Could not save photo.");
    });
  }

  if (!photo) {
    return (
      <div>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => onFile(e.target.files?.[0])}
        />
        <button
          type="button"
          disabled={pending}
          onClick={() => inputRef.current?.click()}
          className="grid w-full place-items-center gap-2 rounded-xl border border-dashed border-line-strong bg-white/60 px-4 py-8 text-center transition-colors hover:border-pen hover:bg-pen-soft/40"
        >
          {pending ? (
            <Spinner className="text-pen" />
          ) : (
            <ImagePlus size={22} className="text-pen" />
          )}
          <span className="text-[0.8rem] font-semibold text-ink">Snap or upload the photo</span>
          <span className="max-w-[220px] text-[0.7rem] leading-relaxed text-ink-faint">
            One clear shot of your paper timetable. It never leaves your account.
          </span>
        </button>
        {error ? <p className="mt-2 text-[0.74rem] font-medium text-bad">{error}</p> : null}
      </div>
    );
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setZoom(true)}
        className="block w-full overflow-hidden rounded-xl border border-line transition-transform hover:scale-[1.01]"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={photo} alt="Timetable reference" className="max-h-56 w-full object-cover" />
      </button>
      <div className="mt-2 flex gap-2">
        <label className="btn btn-ghost flex-1 !py-2 !text-[0.74rem]">
          <RefreshCw size={13} /> Replace
          <input
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            disabled={pending}
            onChange={(e) => onFile(e.target.files?.[0])}
          />
        </label>
        <button
          type="button"
          className="btn btn-quiet !py-2 !text-[0.74rem] hover:!text-bad"
          disabled={pending}
          onClick={() =>
            startTransition(async () => {
              setPhoto(null);
              await clearPhotoAction();
            })
          }
        >
          <Trash2 size={13} />
        </button>
      </div>

      {zoom ? (
        <div
          className="fixed inset-0 z-50 grid place-items-center bg-ink/70 p-4 backdrop-blur-sm"
          onClick={() => setZoom(false)}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={photo}
            alt="Timetable reference, full size"
            className="pop max-h-[88vh] max-w-full rounded-xl shadow-2xl"
          />
        </div>
      ) : null}
    </div>
  );
}

export function TimetableEmptyHint() {
  return (
    <EmptyState
      icon={ImagePlus}
      title="No photo yet"
      body="Add a photo of your timetable for easy reference while filling the grid."
    />
  );
}
