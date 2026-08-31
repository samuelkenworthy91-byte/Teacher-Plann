"use client";

import { useEffect } from "react";
import { Capacitor } from "@capacitor/core";

/**
 * Small bridge to the native shell: tidies the status bar and dismisses the
 * splash screen once React has painted. A no-op in a normal browser.
 */
export function NativeBridge() {
  useEffect(() => {
    if (!Capacitor.isNativePlatform()) return;
    let cancelled = false;

    (async () => {
      try {
        const [{ StatusBar, Style }, { SplashScreen }] = await Promise.all([
          import("@capacitor/status-bar"),
          import("@capacitor/splash-screen"),
        ]);
        if (cancelled) return;
        await StatusBar.setStyle({ style: Style.Light });
        await StatusBar.setBackgroundColor({ color: "#FBF7F0" });
        await SplashScreen.hide();
      } catch {
        // Plugin missing (e.g. running in a plain browser) — nothing to do.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  return null;
}
