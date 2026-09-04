"use client";

import { useEffect, useRef } from "react";
import { Capacitor } from "@capacitor/core";
import { syncLocalNotifications } from "@/lib/local-notifications";
import { useDb } from "@/lib/store";
import type { Database } from "@/lib/types";

const PROMPTED_KEY = "markflow.notifications.prompted.v1";

export function NotificationBridge() {
  const db = useDb();
  const latest = useRef<Database | null>(db);

  useEffect(() => {
    latest.current = db;
    if (!db || !Capacitor.isNativePlatform()) return;

    let requestPermission = false;
    try {
      requestPermission = window.localStorage.getItem(PROMPTED_KEY) !== "1";
      if (requestPermission) window.localStorage.setItem(PROMPTED_KEY, "1");
    } catch {
      requestPermission = true;
    }

    void syncLocalNotifications(db, requestPermission);
  }, [db]);

  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let removeListener: (() => Promise<void>) | undefined;
    let disposed = false;

    void (async () => {
      try {
        const { App } = await import("@capacitor/app");
        const handle = await App.addListener("appStateChange", ({ isActive }) => {
          if (isActive && latest.current) {
            void syncLocalNotifications(latest.current, false);
          }
        });
        if (disposed) await handle.remove();
        else removeListener = () => handle.remove();
      } catch {
        // Browser builds and shells without the App plugin simply skip resume refreshes.
      }
    })();

    return () => {
      disposed = true;
      if (removeListener) void removeListener();
    };
  }, []);

  return null;
}
