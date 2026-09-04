"use client";

import { useState, useTransition } from "react";
import { Wand2 } from "lucide-react";
import { loadDemoData } from "@/lib/demo";
import { Spinner } from "@/components/ui";

export function DemoDataButton({ label = "Load demo timetable" }: { label?: string }) {
  const [pending, start] = useTransition();
  const [done, setDone] = useState(false);

  return (
    <button
      type="button"
      className="btn btn-ghost"
      disabled={pending || done}
      onClick={() =>
        start(() => {
          loadDemoData();
          setDone(true);
        })
      }
    >
      {pending ? <Spinner /> : <Wand2 size={15} />}
      {done ? "Demo data loaded" : label}
    </button>
  );
}
