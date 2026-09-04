import { db } from "@/db";
import { sql } from "drizzle-orm";

/**
 * Additive, idempotent schema sync.
 *
 * This is what lets you drop the updated app onto an existing database
 * WITHOUT losing anything you've already typed in (timetable, classes,
 * plans, settings). Everything is CREATE TABLE IF NOT EXISTS /
 * ADD COLUMN IF NOT EXISTS — no drops, no rewrites, no data migration.
 *
 * It runs once per server process (the promise is cached), so the cost
 * is a single round-trip of cheap catalog checks at boot.
 */
const MIGRATION_SQL = [
  // v2 — "can't do it today" deferrals keep a visible counter
  `ALTER TABLE marking_plans ADD COLUMN IF NOT EXISTS deferred_count integer NOT NULL DEFAULT 0`,
  // v2 — push notification subscriptions (one row per browser/device)
  `CREATE TABLE IF NOT EXISTS push_subscriptions (
     id serial PRIMARY KEY,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     endpoint text NOT NULL UNIQUE,
     p256dh text NOT NULL,
     auth text NOT NULL,
     user_agent text NOT NULL DEFAULT '',
     created_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE INDEX IF NOT EXISTS push_subs_user_idx ON push_subscriptions (user_id)`,
  // v2 — dedupe log so a daily digest is never sent twice
  `CREATE TABLE IF NOT EXISTS push_log (
     id serial PRIMARY KEY,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     day date NOT NULL,
     kind text NOT NULL,
     sent_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS push_log_user_day_kind_idx ON push_log (user_id, day, kind)`,
  // v2 — tiny config store (holds auto-generated VAPID keys if none in env)
  `CREATE TABLE IF NOT EXISTS app_config (
     key text PRIMARY KEY,
     value text NOT NULL
   )`,
];

let bootstrapPromise: Promise<void> | null = null;

export function ensureSchema(): Promise<void> {
  if (!bootstrapPromise) {
    bootstrapPromise = (async () => {
      for (const stmt of MIGRATION_SQL) {
        try {
          await db.execute(sql.raw(stmt));
        } catch (err) {
          // Never let a housekeeping statement take the app down —
          // worst case the feature reports "not available".
          console.error("[bootstrap] statement failed:", (err as Error).message);
        }
      }
    })();
  }
  return bootstrapPromise;
}
