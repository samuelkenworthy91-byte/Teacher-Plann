"use client";

import { Capacitor } from "@capacitor/core";
import { LocalNotifications, type LocalNotificationSchema } from "@capacitor/local-notifications";
import { addDays, prettyShort, todayStr } from "@/lib/dates";
import { requiredToday } from "@/lib/engine";
import type { Database, PlanRow } from "@/lib/types";

const SOURCE = "markflow";
const HORIZON_DAYS = 14;
const MAX_PENDING = 60;
const MORNING_HOUR = 7;
const MORNING_MINUTE = 30;
const MARKING_HOUR = 16;
const MARKING_MINUTE = 0;

type ReminderKind = "collect" | "handback" | "pace";
type BuiltReminder = { at: Date; notification: LocalNotificationSchema };

function localDateAt(date: string, hour: number, minute: number): Date {
  const [year, month, day] = date.split("-").map(Number);
  return new Date(year, month - 1, day, hour, minute, 0, 0);
}

function isWeekday(date: string): boolean {
  const d = localDateAt(date, 12, 0).getDay();
  return d >= 1 && d <= 5;
}

function inWindow(date: string, from: string, to: string): boolean {
  return date >= from && date <= to;
}

/** Stable positive 32-bit notification id from plan + date + reminder kind. */
function reminderId(planId: number, date: string, kind: ReminderKind): number {
  const input = `${planId}:${date}:${kind}`;
  let hash = 2166136261;
  for (let i = 0; i < input.length; i += 1) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return 100_000_000 + ((hash >>> 0) % 1_900_000_000);
}

function reminder(
  plan: PlanRow,
  date: string,
  kind: ReminderKind,
  at: Date,
  title: string,
  body: string,
): BuiltReminder {
  return {
    at,
    notification: {
      id: reminderId(plan.id, date, kind),
      title,
      body,
      largeBody: body,
      schedule: { at, allowWhileIdle: true },
      autoCancel: true,
      group: "markflow-reminders",
      extra: { source: SOURCE, kind, planId: plan.id, date },
    },
  };
}

export function buildLocalReminders(db: Database, now = new Date()): LocalNotificationSchema[] {
  const today = todayStr();
  const horizon = addDays(today, HORIZON_DAYS);
  const classes = new Map(db.classes.map((c) => [c.id, c]));
  const built: BuiltReminder[] = [];

  for (const plan of db.plans) {
    if (plan.status === "returned") continue;
    const cls = classes.get(plan.classId);
    if (!cls) continue;

    if (plan.status === "scheduled" && inWindow(plan.collectDate, today, horizon)) {
      const at = localDateAt(plan.collectDate, MORNING_HOUR, MORNING_MINUTE);
      if (at.getTime() > now.getTime()) {
        const period = plan.collectPeriod ? ` · Period ${plan.collectPeriod}` : "";
        built.push(
          reminder(
            plan,
            plan.collectDate,
            "collect",
            at,
            `Collect ${cls.name} today`,
            `${plan.title}${period}. ${plan.totalBooks} books; hand back ${prettyShort(plan.handbackDate)}.`,
          ),
        );
      }
    }

    if (inWindow(plan.handbackDate, today, horizon)) {
      const at = localDateAt(plan.handbackDate, MORNING_HOUR, MORNING_MINUTE);
      if (at.getTime() > now.getTime()) {
        const remaining = Math.max(0, plan.totalBooks - plan.markedCount);
        const period = plan.handbackPeriod ? ` · Period ${plan.handbackPeriod}` : "";
        const state =
          remaining === 0
            ? "All marked — take them with you."
            : `${remaining} book${remaining === 1 ? "" : "s"} still to mark.`;
        built.push(
          reminder(
            plan,
            plan.handbackDate,
            "handback",
            at,
            `Hand back ${cls.name} today`,
            `${plan.title}${period}. ${state}`,
          ),
        );
      }
    }

    if (plan.status === "marking") {
      const end = plan.handbackDate < horizon ? plan.handbackDate : horizon;
      let date = plan.collectDate > today ? plan.collectDate : today;
      while (date <= end) {
        if (isWeekday(date)) {
          const need = requiredToday(plan, date);
          const at = localDateAt(date, MARKING_HOUR, MARKING_MINUTE);
          if (need > 0 && at.getTime() > now.getTime()) {
            const remaining = Math.max(0, plan.totalBooks - plan.markedCount);
            built.push(
              reminder(
                plan,
                date,
                "pace",
                at,
                `Mark ${need} book${need === 1 ? "" : "s"} today`,
                `${cls.name}: ${remaining} left now · hand back ${prettyShort(plan.handbackDate)}.`,
              ),
            );
          }
        }
        date = addDays(date, 1);
      }
    }
  }

  return built
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_PENDING)
    .map((x) => x.notification);
}

let syncQueue: Promise<void> = Promise.resolve();

async function syncNow(db: Database, requestPermission: boolean): Promise<void> {
  if (!Capacitor.isNativePlatform()) return;

  let permission = await LocalNotifications.checkPermissions();
  if (
    requestPermission &&
    (permission.display === "prompt" || permission.display === "prompt-with-rationale")
  ) {
    permission = await LocalNotifications.requestPermissions();
  }
  if (permission.display !== "granted") return;

  const pending = await LocalNotifications.getPending();
  const ours = pending.notifications
    .filter((n) => n.extra?.source === SOURCE)
    .map((n) => ({ id: n.id }));
  if (ours.length > 0) await LocalNotifications.cancel({ notifications: ours });

  const notifications = buildLocalReminders(db);
  if (notifications.length > 0) {
    await LocalNotifications.schedule({ notifications });
  }
}

/**
 * Serialize schedule rebuilds so rapid marking taps cannot race one another.
 * Every rebuild removes only MarkFlow-owned pending notifications and then
 * recreates the next fortnight from the current on-device database.
 */
export function syncLocalNotifications(db: Database, requestPermission = false): Promise<void> {
  syncQueue = syncQueue
    .catch(() => undefined)
    .then(() => syncNow(db, requestPermission))
    .catch((error) => {
      console.warn("MarkFlow: could not refresh local reminders", error);
    });
  return syncQueue;
}
