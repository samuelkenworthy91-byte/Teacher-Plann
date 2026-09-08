import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBundle } from "@/lib/queries";
import { buildNotices } from "@/lib/engine";
import { hasStaleAutoPlans } from "@/lib/plan-sync";
import { prettyLong } from "@/lib/dates";
import { Shell } from "@/components/shell";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const bundle = await getBundle(user.id);
  const notices = buildNotices({
    today: bundle.today,
    classes: bundle.classes,
    plans: bundle.plans,
    entries: bundle.entries,
    settings: bundle.settings,
    unavailableDates: bundle.unavailableDates.map((day) => day.date),
  });
  const activeCount = bundle.plans.filter((p) => p.status === "marking").length;

  return (
    <Shell
      userName={user.name}
      notices={notices}
      activeCount={activeCount}
      dateLabel={prettyLong(bundle.today)}
      needsPlanRefresh={hasStaleAutoPlans(bundle.plans, bundle.today)}
    >
      {children}
    </Shell>
  );
}
