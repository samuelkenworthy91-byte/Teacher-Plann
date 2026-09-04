import webpush from "web-push";
import { db } from "@/db";
import { appConfig, pushLog, pushSubscriptions, users } from "@/db/schema";
import { ensureSchema } from "@/lib/bootstrap";
import { getBundle } from "@/lib/queries";
import { buildNotices } from "@/lib/engine";
import { todayStr } from "@/lib/dates";
import { and, eq } from "drizzle-orm";

/**
 * Push notifications.
 *
 * VAPID keys come from env when available (recommended for production):
 *   VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY, VAPID_SUBJECT (mailto:…)
 * When they're missing, a keypair is generated once and stored in the
 * app_config table so notifications work out of the box — no setup
 * required. (Keys identify your server; re-generating them invalidates
 * existing subscriptions, hence the persistence.)
 */

export type VapidKeys = { publicKey: string; privateKey: string; subject: string };

let cachedKeys: VapidKeys | null = null;

export async function getVapidKeys(): Promise<VapidKeys | null> {
  if (cachedKeys) return cachedKeys;
  try {
    await ensureSchema();
    const subject = process.env.VAPID_SUBJECT ?? "mailto:hello@markflow.app";

    if (process.env.VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY) {
      cachedKeys = {
        publicKey: process.env.VAPID_PUBLIC_KEY,
        privateKey: process.env.VAPID_PRIVATE_KEY,
        subject,
      };
      return cachedKeys;
    }

    const existing = await db.select().from(appConfig).where(eq(appConfig.key, "vapid")).limit(1);
    if (existing[0]) {
      const parsed = JSON.parse(existing[0].value) as { publicKey: string; privateKey: string };
      cachedKeys = { ...parsed, subject };
      return cachedKeys;
    }

    const generated = webpush.generateVAPIDKeys();
    const value = JSON.stringify(generated);
    await db.insert(appConfig).values({ key: "vapid", value }).onConflictDoNothing();
    // If another process won the race, adopt its keys so all workers agree.
    const row = await db.select().from(appConfig).where(eq(appConfig.key, "vapid")).limit(1);
    const finalKeys = row[0] ? (JSON.parse(row[0].value) as { publicKey: string; privateKey: string }) : generated;
    cachedKeys = { ...finalKeys, subject };
    return cachedKeys;
  } catch (err) {
    console.error("[push] could not load VAPID keys:", (err as Error).message);
    return null;
  }
}

export type PushPayload = {
  title: string;
  body: string;
  url?: string;
  tag?: string;
};

/** Send one payload to every device subscribed for a user. Prunes dead endpoints. */
export async function sendPushToUser(userId: number, payload: PushPayload): Promise<{ sent: number; gone: number }> {
  const keys = await getVapidKeys();
  if (!keys) return { sent: 0, gone: 0 };

  const subs = await db
    .select()
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  if (subs.length === 0) return { sent: 0, gone: 0 };

  webpush.setVapidDetails(keys.subject, keys.publicKey, keys.privateKey);

  let sent = 0;
  let gone = 0;
  await Promise.all(
    subs.map(async (s) => {
      try {
        await webpush.sendNotification(
          { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
          JSON.stringify(payload),
          { TTL: 24 * 3600, urgency: "normal" },
        );
        sent++;
      } catch (err) {
        const status = (err as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          // subscription expired / revoked — clean it up
          gone++;
          await db.delete(pushSubscriptions).where(eq(pushSubscriptions.id, s.id)).catch(() => {});
        } else {
          console.error("[push] send failed:", (err as Error).message);
        }
      }
    }),
  );
  return { sent, gone };
}

/** How many devices this user has subscribed (for the settings UI). */
export async function countSubscriptions(userId: number): Promise<number> {
  await ensureSchema();
  const rows = await db
    .select({ id: pushSubscriptions.id })
    .from(pushSubscriptions)
    .where(eq(pushSubscriptions.userId, userId));
  return rows.length;
}

/* ------------------------------------------------------------------ */
/* The daily digest                                                    */
/* ------------------------------------------------------------------ */

/** Turn today's notices into one compact push message. */
export async function buildDailyDigest(userId: number): Promise<PushPayload | null> {
  const [user] = await db.select().from(users).where(eq(users.id, userId)).limit(1);
  if (!user) return null;

  const bundle = await getBundle(userId);
  const notices = buildNotices({
    today: bundle.today,
    classes: bundle.classes,
    plans: bundle.plans,
    entries: bundle.entries,
    settings: bundle.settings,
  });

  const urgent = notices.filter((n) => n.tone === "bad" || n.tone === "warn" || n.tone === "pen");
  const heads = (urgent.length > 0 ? urgent : notices).slice(0, 2);
  if (heads.length === 0) return null;

  const isBad = heads.some((n) => n.tone === "bad");
  const title = isBad ? "MarkFlow — needs attention today" : "MarkFlow — today's marking";
  const body =
    heads.map((n) => n.title).join(" · ") + (urgent.length > 2 ? ` (+${urgent.length - 2} more)` : "");
  return { title, body, url: "/dashboard", tag: "daily" };
}

/**
 * Send every subscriber their daily digest exactly once per day.
 * Call from cron (recommended) or the /api/push/digest endpoint.
 */
export async function sendDailyDigests(): Promise<{ users: number; sent: number }> {
  await ensureSchema();
  const today = todayStr();

  const rows = await db
    .selectDistinct({ userId: pushSubscriptions.userId })
    .from(pushSubscriptions);
  let sentTotal = 0;
  let userCount = 0;

  for (const { userId } of rows) {
    // Exactly-once guard: first writer for (user, day) proceeds, others skip.
    const claimed = await db
      .insert(pushLog)
      .values({ userId, day: today, kind: "daily" })
      .onConflictDoNothing()
      .returning();
    if (claimed.length === 0) continue;

    const digest = await buildDailyDigest(userId);
    if (!digest) continue;
    const { sent } = await sendPushToUser(userId, digest);
    if (sent > 0) {
      sentTotal += sent;
      userCount++;
    }
  }
  return { users: userCount, sent: sentTotal };
}

/* ------------------------------------------------------------------ */
/* Subscription management (used by server actions)                    */
/* ------------------------------------------------------------------ */

export async function saveSubscription(
  userId: number,
  sub: { endpoint: string; keys: { p256dh: string; auth: string } },
  userAgent: string,
): Promise<void> {
  await ensureSchema();
  await db
    .insert(pushSubscriptions)
    .values({
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent: userAgent.slice(0, 250),
    })
    .onConflictDoUpdate({
      target: pushSubscriptions.endpoint,
      set: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent: userAgent.slice(0, 250) },
    });
}

export async function removeSubscription(userId: number, endpoint: string): Promise<void> {
  await ensureSchema();
  await db
    .delete(pushSubscriptions)
    .where(and(eq(pushSubscriptions.endpoint, endpoint), eq(pushSubscriptions.userId, userId)));
}
