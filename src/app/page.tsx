"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { BootSplash } from "@/components/boot-splash";

/**
 * The APK opens `index.html`, so this is the app's real entry point:
 * hand straight over to the dashboard.
 */
export default function HomePage() {
  const router = useRouter();

  useEffect(() => {
    router.replace("/dashboard");
  }, [router]);

  return <BootSplash />;
}
