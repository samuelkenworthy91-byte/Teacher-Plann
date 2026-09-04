/**
 * Additive-only migration for updating an existing MarkFlow install
 * WITHOUT losing any data (timetable, classes, plans, settings, history).
 *
 *   DATABASE_URL=postgres://… npm run migrate
 *
 * Safe to run any number of times. Also runs automatically at app boot
 * (see src/lib/bootstrap.ts), so running this script is optional — it
 * just lets you verify the database up front.
 */
import "dotenv/config";
import { Client } from "pg";

const STATEMENTS = [
  `ALTER TABLE marking_plans ADD COLUMN IF NOT EXISTS deferred_count integer NOT NULL DEFAULT 0`,
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
  `CREATE TABLE IF NOT EXISTS push_log (
     id serial PRIMARY KEY,
     user_id integer NOT NULL REFERENCES users(id) ON DELETE CASCADE,
     day date NOT NULL,
     kind text NOT NULL,
     sent_at timestamp NOT NULL DEFAULT now()
   )`,
  `CREATE UNIQUE INDEX IF NOT EXISTS push_log_user_day_kind_idx ON push_log (user_id, day, kind)`,
  `CREATE TABLE IF NOT EXISTS app_config (
     key text PRIMARY KEY,
     value text NOT NULL
   )`,
];

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required (put it in .env or the environment).");
  process.exit(1);
}

const client = new Client({ connectionString: url });
await client.connect();
try {
  for (const stmt of STATEMENTS) {
    await client.query(stmt);
    console.log("ok:", stmt.split("\n")[0].slice(0, 72));
  }
  console.log("\nMigration complete. All existing data is untouched.");
} finally {
  await client.end();
}
