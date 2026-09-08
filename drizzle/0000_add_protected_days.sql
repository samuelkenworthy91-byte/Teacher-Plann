CREATE TABLE IF NOT EXISTS "unavailable_dates" (
  "id" serial PRIMARY KEY NOT NULL,
  "user_id" integer NOT NULL REFERENCES "users"("id") ON DELETE cascade,
  "date" date NOT NULL,
  "reason" text DEFAULT '' NOT NULL,
  "created_at" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX IF NOT EXISTS "unavailable_dates_user_date_idx"
  ON "unavailable_dates" USING btree ("user_id", "date");
--> statement-breakpoint
CREATE INDEX IF NOT EXISTS "unavailable_dates_user_idx"
  ON "unavailable_dates" USING btree ("user_id");
