"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw } from "lucide-react";
import { refreshStalePlanAction } from "@/actions/plans";

/**
 * The server tells us when an untouched automatic collection was missed. On
 * opening the app we quietly rebuild those expired suggestions and reload the
 * page, so yesterday's plan cannot linger in today's diary.
 */
export function PlanAutoRefresh({ needed }: { needed: boolean }) {
  const router = useRouter();
  const hasStarted = useRef(false);
  const [finished, setFinished] = useState(false);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    if (!needed || hasStarted.current) return;
    hasStarted.current = true;
    startTransition(async () => {
      const result = await refreshStalePlanAction();
      if (result.ok && result.refreshed) router.refresh();
      else setFinished(true);
    });
  }, [needed, router, startTransition]);

  if (!needed || finished) return null;
  return (
    <span
      className="hidden items-center gap-1.5 text-[0.68rem] font-semibold text-pen sm:inline-flex"
      aria-live="polite"
    >
      <RefreshCw size={12} className={pending ? "animate-spin" : ""} />
      Refreshing diary
    </span>
  );
}
