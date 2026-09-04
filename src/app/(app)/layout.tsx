import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/auth";
import { getBundle } from "@/lib/queries";
import { buildNotices } from "@/lib/engine";
import { prettyLong } from "@/lib/dates";
import { Shell } from "@/components/shell";
import { PushPing } from "@/components/push-ping";
import { countSubscriptions } from "@/lib/push";

export const dynamic = "force-dynamic";

export default async function AppLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  const [bundle, subs] = await Promise.all([
    getBundle(user.id),
    // has this teacher got any device subscribed to pushes? (for the daily digest ping)
    countSubscriptions(user.id),
  ]);
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
      userName={user.name}
      notices={notices}
      activeCount={activeCount}
      dateLabel={prettyLong(bundle.today)}
      hasPushSubscriptions={subs > 0}
    >
      {children}
    </Shell>
  );
}
