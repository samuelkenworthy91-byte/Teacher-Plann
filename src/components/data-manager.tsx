"use client";

import { useRef, useState } from "react";
import { Download, Smartphone, TriangleAlert, Trash2, Upload } from "lucide-react";
import { getDb, replaceDb, resetDb } from "@/lib/store";
import { DemoDataButton } from "@/components/demo-data-button";
import { Modal } from "@/components/ui";
import type { Database } from "@/lib/types";

/**
 * Offline apps need an escape hatch: back the device database up to a file,
 * restore it on a new phone, or wipe it.
 */
export function DataManager() {
  const fileRef = useRef<HTMLInputElement>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [confirmWipe, setConfirmWipe] = useState(false);

  function exportJson() {
    const blob = new Blob([JSON.stringify(getDb(), null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `markflow-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
    setError(null);
    setMessage("Backup saved to your downloads.");
  }

  async function importJson(file: File | undefined) {
    if (!file) return;
    try {
      const parsed = JSON.parse(await file.text()) as Database;
      if (!parsed || typeof parsed !== "object" || !Array.isArray(parsed.classes)) {
        throw new Error("bad file");
      }
      replaceDb(parsed);
      setError(null);
      setMessage("Backup restored.");
    } catch {
      setMessage(null);
      setError("That file isn't a MarkFlow backup.");
    }
  }

  return (
    <section className="card rise p-6" style={{ animationDelay: "180ms" }}>
      <div className="flex items-center gap-2">
        <Smartphone size={16} className="text-pen" />
        <h2 className="font-display text-lg font-semibold text-ink">Your data</h2>
      </div>
      <p className="mt-1 text-[0.8rem] leading-relaxed text-ink-soft">
        MarkFlow works entirely offline — classes, timetable and marking history live on this device
        only. Back them up before changing phone.
      </p>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" className="btn btn-ghost" onClick={exportJson}>
          <Download size={15} /> Export backup
        </button>
        <button type="button" className="btn btn-ghost" onClick={() => fileRef.current?.click()}>
          <Upload size={15} /> Restore backup
        </button>
        <DemoDataButton label="Replace with demo data" />
        <button
          type="button"
          className="btn btn-quiet hover:!text-bad"
          onClick={() => setConfirmWipe(true)}
        >
          <Trash2 size={15} /> Erase everything
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json"
          className="hidden"
          onChange={(e) => importJson(e.target.files?.[0])}
        />
      </div>

      {message ? (
        <p className="mt-3 rounded-xl bg-good-soft px-4 py-3 text-[0.8rem] font-medium text-good">
          {message}
        </p>
      ) : null}
      {error ? (
        <p className="mt-3 flex items-center gap-2 rounded-xl bg-bad-soft px-4 py-3 text-[0.8rem] font-medium text-bad">
          <TriangleAlert size={15} /> {error}
        </p>
      ) : null}

      <Modal
        open={confirmWipe}
        onClose={() => setConfirmWipe(false)}
        title="Erase everything?"
        subtitle="Classes, timetable, plans and marking history will be deleted from this device."
      >
        <div className="flex justify-end gap-2">
          <button type="button" className="btn btn-quiet" onClick={() => setConfirmWipe(false)}>
            Cancel
          </button>
          <button
            type="button"
            className="btn btn-danger"
            onClick={() => {
              resetDb();
              setConfirmWipe(false);
              setMessage("All data erased.");
            }}
          >
            <Trash2 size={15} /> Erase
          </button>
        </div>
      </Modal>
    </section>
  );
}
