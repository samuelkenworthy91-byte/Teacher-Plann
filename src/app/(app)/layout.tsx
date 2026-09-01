"use client";

import type { ReactNode } from "react";
import { buildNotices } from "@/lib/engine";
import { prettyLong } from "@/lib/dates";
import { useBundle } from "@/lib/store";
import { Shell } from "@/components/shell";
import { BootSplash } from "@/components/boot-splash";

export default function AppLayout({ children }: { children: ReactNode }) {
  const bundle = useBundle();

  if (!bundle) return <BootSplash />;

  const notices = buildNotices({
    today: bundle.today,
    classes: bundle.classes,
    plans: bundle.plans,
    entries: bundle.entries,
    settings: bundle.settings,
  });
  const activeCount = bundle.plans.filter((p) => p.status === "marking").length;

  return (
    <Shell
      userName={bundle.profile.name}
      notices={notices}
      activeCount={activeCount}
      dateLabel={prettyLong(bundle.today)}
    >
      {children}
    </Shell>
  );
}
