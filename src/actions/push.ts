"use server";

import { headers } from "next/headers";
import { getCurrentUser } from "@/lib/auth";
import { countSubscriptions, removeSubscription, saveSubscription, sendPushToUser } from "@/lib/push";
import type { ActionResult } from "@/actions/classes";

type BrowserSubscription = {
  endpoint: string;
  keys: { p256dh: string; auth: string };
};

export async function savePushSubscriptionAction(sub: BrowserSubscription): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) {
    return { ok: false, error: "Bad subscription payload." };
  }
  try {
    const ua = (await headers()).get("user-agent") ?? "";
    await saveSubscription(user.id, sub, ua);
    return { ok: true };
  } catch (err) {
    return { ok: false, error: (err as Error).message };
  }
}

export async function removePushSubscriptionAction(endpoint: string): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  await removeSubscription(user.id, endpoint);
  return { ok: true };
}

export async function sendTestPushAction(): Promise<ActionResult> {
  const user = await getCurrentUser();
  if (!user) return { ok: false, error: "Not signed in." };
  const { sent } = await sendPushToUser(user.id, {
    title: "MarkFlow — test notification",
    body: "Push notifications are working. I'll nudge you on collection days and marking pace.",
    url: "/dashboard",
    tag: "test",
  });
  if (sent === 0) {
    return { ok: false, error: "No device received it — enable notifications on this device first." };
  }
  return { ok: true };
}

export async function countPushSubscriptionsAction(): Promise<number> {
  const user = await getCurrentUser();
  if (!user) return 0;
  return countSubscriptions(user.id);
}
