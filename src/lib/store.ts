"use client";

/**
 * MarkFlow's offline database.
 *
 * Everything lives on the device: a single JSON document in localStorage,
 * mutated through small helpers and broadcast to React via useSyncExternalStore.
 * No network, no accounts, no server — the APK works in flight mode.
 */

import { useSyncExternalStore } from "react";
import { todayStr } from "@/lib/dates";
import { DEFAULT_SETTINGS, type Database } from "@/lib/types";

export const STORAGE_KEY = "markflow.db.v1";
const DB_VERSION = 1;

export function emptyDatabase(): Database {
  return {
    version: DB_VERSION,
    seq: 1,
    profile: { name: "Teacher" },
    settings: { ...DEFAULT_SETTINGS },
    classes: [],
    slots: [],
    plans: [],
    entries: [],
    photo: null,
  };
}

/* ------------------------------------------------------------------ */
/* Store internals                                                     */
/* ------------------------------------------------------------------ */

let memory: Database | null = null;
let hydrated = false;
const listeners = new Set<() => void>();

function readStorage(): Database {
  if (typeof window === "undefined") return emptyDatabase();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyDatabase();
    const parsed = JSON.parse(raw) as Partial<Database>;
    return migrate(parsed);
  } catch {
    return emptyDatabase();
  }
}

function migrate(input: Partial<Database>): Database {
  const base = emptyDatabase();
  return {
    ...base,
    ...input,
    version: DB_VERSION,
    profile: { ...base.profile, ...(input.profile ?? {}) },
    settings: { ...base.settings, ...(input.settings ?? {}) },
    classes: input.classes ?? [],
    slots: input.slots ?? [],
    plans: input.plans ?? [],
    entries: input.entries ?? [],
    photo: input.photo ?? null,
  };
}

function persist(db: Database) {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(db));
  } catch (err) {
    // Quota exceeded (usually a very large timetable photo).
    console.warn("MarkFlow: could not save to device storage", err);
  }
}

/** Current database. Reads from localStorage the first time it is needed. */
export function getDb(): Database {
  if (!memory) {
    memory = readStorage();
    hydrated = typeof window !== "undefined";
  }
  return memory;
}

export function isHydrated() {
  return hydrated;
}

function emit() {
  for (const fn of listeners) fn();
}

/** Apply a change, persist it and re-render every subscribed screen. */
export function mutate(recipe: (db: Database) => Database | void): Database {
  const current = getDb();
  const draft: Database = structuredCloneSafe(current);
  const result = recipe(draft) ?? draft;
  memory = result;
  persist(result);
  emit();
  return result;
}

export function replaceDb(next: Database) {
  memory = migrate(next);
  persist(memory);
  emit();
}

export function resetDb() {
  replaceDb(emptyDatabase());
}

/** Monotonic ids, mimicking the old SQL `serial` columns. */
export function nextId(db: Database): number {
  db.seq += 1;
  return db.seq;
}

function structuredCloneSafe<T>(value: T): T {
  if (typeof structuredClone === "function") return structuredClone(value);
  return JSON.parse(JSON.stringify(value)) as T;
}

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (typeof window !== "undefined") {
    // Keep multiple tabs / WebView instances in sync.
    const onStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        memory = readStorage();
        listener();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(listener);
      window.removeEventListener("storage", onStorage);
    };
  }
  return () => listeners.delete(listener);
}

const SERVER_SNAPSHOT: Database | null = null;

/* ------------------------------------------------------------------ */
/* React bindings                                                      */
/* ------------------------------------------------------------------ */

/**
 * Returns the device database, or `null` on the very first (server-rendered)
 * paint so static HTML and the hydrated client always agree.
 */
export function useDb(): Database | null {
  return useSyncExternalStore(
    subscribe,
    () => getDb(),
    () => SERVER_SNAPSHOT,
  );
}

export type Bundle = Database & { today: string };

/** Everything a screen needs, in one object (the old `getBundle`). */
export function useBundle(): Bundle | null {
  const db = useDb();
  if (!db) return null;
  return { ...db, today: todayStr() };
}
