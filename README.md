# MarkFlow — the teacher's marking rhythm

An **offline-first Android app** that plans your formative marking: snap your timetable,
add your classes, and MarkFlow schedules every collection and hand-back so you never
mark two sets of books at once and never break the two-week feedback promise.

Everything runs on the phone. No account, no server, no internet — the whole database
lives in the device's local storage and can be exported to a JSON backup.

---

## What's in the box

| Path | What it is |
| --- | --- |
| `src/app` | Next.js App Router screens (statically exported — no server at runtime) |
| `src/components` | UI: shell, dashboard, planner board, timetable editor, marking widgets |
| `src/actions` | Data mutations — plain client functions writing to the on-device store |
| `src/lib/store.ts` | The offline database (localStorage + `useSyncExternalStore`) |
| `src/lib/engine.ts` | The scheduling engine (lesson counting, windows, clash avoidance) |
| `src/lib/demo.ts` | One-tap demo timetable, ported from the old SQL seed |
| `android/` | Capacitor Android project (committed, regenerated assets on sync) |
| `.github/workflows/android-build.yml` | CI that builds and uploads the APK |

## Requirements

- Node.js 22+
- For local APK builds only: JDK 21 and the Android SDK (Android Studio is easiest)

## Develop in the browser

```bash
npm install
npm run dev          # http://localhost:3000
```

## Build the web bundle

```bash
npm run build        # static export → out/
npm start            # serve out/ locally, exactly as the APK sees it
```

## Build the APK locally

```bash
npm run android:apk  # build → cap sync → gradle assembleDebug
# → android/app/build/outputs/apk/debug/app-debug.apk
```

Other helpers:

```bash
npm run cap:sync      # rebuild the web bundle and copy it into android/
npm run android:open  # open the project in Android Studio
npm run android:run   # build and run on a connected device/emulator
```

Install the APK on a phone with `adb install -r app-debug.apk`, or copy it across and
open it (you'll need "install unknown apps" enabled).

## Build the APK with GitHub Actions

`android-build.yml` runs on every push, on pull requests, and on
manual dispatch. It lints, type-checks, exports the web bundle, syncs Capacitor and
runs `./gradlew assembleDebug`.

**Download it:** Actions → *Build Android APK* → pick the run → **Artifacts** →
`markflow-debug-apk`.

Push a tag to also publish it as a GitHub Release:

```bash
git tag v1.0.0 && git push origin v1.0.0
```

The APK is **debug-signed** — installable on any device, but not Play Store ready.
To ship a signed release later, add a keystore to repository secrets and swap the
Gradle step for `assembleRelease` with signing properties.

`versionName` / `versionCode` are stamped from the workflow run number, so every build
is installable over the last one.

## Changing the app identity

| What | Where |
| --- | --- |
| App id (`app.markflow.planner`) | `capacitor.config.ts` + `android/app/build.gradle` |
| App name | `capacitor.config.ts`, `android/app/src/main/res/values/strings.xml` |
| Icon / splash sources | `assets/` (generated resources live in `android/app/src/main/res/`) |

## Screen fit on phones

Android 15 draws apps edge-to-edge, which would tuck the top bar under the status
bar and camera cut-out. Two things keep the UI clear of it:

- `capacitor.config.ts` → `android.adjustMarginsForEdgeToEdge: "force"` plus
  `StatusBar.overlaysWebView: false` (also applied at runtime in
  `src/components/native-bridge.tsx`).
- `safe-top` / `safe-bottom` / `safe-x` / `safe-inset` CSS helpers in
  `src/app/globals.css`, applied to the top bar, sidebar, drawer, page content and
  full-screen overlays, so notches and gesture bars never cover controls.

## Your data

- Stored only on the device, under the `markflow.db.v1` key.
- **Settings → Your data** exports a JSON backup, restores one, loads demo data, or
  erases everything.
- Uninstalling the app deletes the data — export a backup first.
