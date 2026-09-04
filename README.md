# MarkFlow — Teacher-Plann

The teacher's marking planner: enter your timetable and class sizes once, and
MarkFlow schedules every formative check so you mark **one pile at a time**,
never miss your two-week feedback promise, and always know today's minimum.

Demo login (seeded database): `demo@markflow.app` / `demo1234`

---

## What's in this update

### 1. "I can't do it today" — life happens, the plan bends

- **Can't collect a pile today?** On the Today page, the Marking page
  ("Coming up") and the planner diary, hit *Can't collect today*. The cycle
  slides to that class's **next lesson**, the hand-back window is rebuilt from
  there, and the rest of the diary reshuffles around it.
- **Can't keep the marking pace?** On the focus panel (Today or Marking page),
  hit *Can't keep the pace today?* — the hand-back moves to the class's next
  lesson, the daily minimum is recalculated over what's actually left to mark,
  and everything else rebalances.
- Moved piles show a `moved ×N` chip and are **locked**, so regeneration never
  quietly un-does your change.

### 2. "I've taken something in" — assessments & off-schedule piles

*Taken books in* (Marking page + Smart Planner) records a pile that wasn't on
the schedule — end-of-topic assessment, mocks, cover marking. It lands on your
desk immediately with a sensible hand-back date (the class's next lesson after
your usual turnaround window — override it if you like), and the flexible part
of the diary is re-staggered around it.

**Crossover is a last resort.** The planner only lets two piles overlap when
the alternative is a class blowing through its max-days promise — and the
planner banner then labels it an *expected crossover* so you know it was
deliberate, not a bug.

### 3. Update your existing app without losing your timetable

All schema changes are **additive** (one new column, three new tables for
push notifications). Nothing is dropped or rewritten — your timetable,
classes, plans and history stay exactly where they are.

To update an existing install:

```bash
git pull                 # or copy the new source over your install
npm install              # adds web-push
npm run migrate          # optional — additive-only; also runs automatically at boot
npm run build && npm start
```

`npm run migrate` (or `src/lib/bootstrap.ts` at first boot) only ever runs
`CREATE TABLE IF NOT EXISTS` / `ADD COLUMN IF NOT EXISTS`. It is safe to run
repeatedly and safe to skip.

### 4. Push notifications

- **Enable**: Settings → *Push notifications* → **Enable on this device**
  (there's a *Send test* button to prove the pipeline). Each browser/device is
  subscribed individually — phone, tablet and laptop can all be nudged.
- **What arrives**: one quiet digest per morning with today's collections and
  marking pace, plus warnings when a pile is running late. If you already have
  the relevant page open, the service worker stays silent.
- **Delivery**: the app sends the digest the first time it's opened each day,
  with **no configuration**. For notifications that arrive even when you
  haven't opened the app, point a daily cron job at:

  ```bash
  curl -X POST https://your-host/api/push/digest -H "Authorization: Bearer $CRON_SECRET"
  ```

  (Vercel Cron, GitHub Actions, cron-job.org or plain crontab all work.)
- **Keys**: VAPID keys are generated and stored automatically on first run.
  For production you can instead set `VAPID_PUBLIC_KEY`, `VAPID_PRIVATE_KEY`
  and optionally `VAPID_SUBJECT` (generate with `npx web-push
  generate-vapid-keys`). Set `CRON_SECRET` if the digest endpoint is exposed
  publicly.
- **iPhone/iPad**: needs iOS 16.4+ and the app added to the Home Screen
  (Share → Add to Home Screen). A web-app manifest and icons are included, so
  MarkFlow installs like a native app everywhere.

### 5. New icon

A proper app icon — paper tile, marker-stroke **M**, and the pen's red tick:
favicon, Apple touch icon, PWA manifest icons, and the in-app logo all match.
Regenerate any time with `npm run icons` (needs Python + Pillow).

---

## Development

```bash
npm install
cp .env.example .env          # set DATABASE_URL
npm run db:push               # create the schema (first run only)
npm run seed                  # optional demo data
npm run dev
```

| Script | What it does |
| --- | --- |
| `npm run dev` | dev server |
| `npm run build` / `start` | production build / serve |
| `npm run db:push` | apply `src/db/schema.ts` to the database (drizzle-kit) |
| `npm run migrate` | additive-only migration script (safe on live data) |
| `npm run seed` | demo teacher, timetable and diary |
| `npm run icons` | regenerate the icon set |
| `npm run lint` / `typecheck` | lint / TypeScript |

## How the scheduler thinks

1. Every class earns a formative every `minLessons`–`maxLessons` lessons
   (Settings), and **never** waits more than `maxGapDays` between hand-backs.
2. A pile is collected in one lesson and handed back `windowDays` school days
   later, in that class's next lesson.
3. Collection→hand-back windows are staggered so only one pile is live at a
   time. Deferrals and off-schedule piles become fixed anchors; the rest of
   the diary reshuffles around them, crossing over **only** when the
   alternative is breaking the max-gap promise.
