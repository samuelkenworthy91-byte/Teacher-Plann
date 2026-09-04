"use client";

import { useEffect } from "react";

/**
 * Zero-config digest delivery: the first app load of the day (in any
 * signed-in browser) pings the digest endpoint so subscribed devices get
 * their daily nudge even when no external cron job is configured. The
 * server dedupes per user per day, and the service worker stays quiet
 * if you're already looking at the relevant page.
 */
export function PushPing({ hasSubscriptions }: { hasSubscriptions: boolean }) {
  useEffect(() => {
    if (!hasSubscriptions) return;
    try {
      const today = new Date().toISOString().slice(0, 10);
      if (localStorage.getItem("mf-digest-day") === today) return;
      localStorage.setItem("mf-digest-day", today);
      void fetch("/api/push/digest", { method: "POST" }).catch(() => {});
    } catch {
      /* private mode etc. — cron still works */
    }
  }, [hasSubscriptions]);
  return null;
}
