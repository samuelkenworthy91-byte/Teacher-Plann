import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
// Self-hosted fonts: bundled into the APK so the app never touches the network.
import "@fontsource-variable/inter";
import "@fontsource-variable/fraunces";
import "@fontsource-variable/fraunces/opsz-italic.css";
import "./globals.css";
import "./mobile-fit.css";
import { NativeBridge } from "@/components/native-bridge";
import { NotificationBridge } from "@/components/notification-bridge";

export const metadata: Metadata = {
  title: {
    default: "MarkFlow — Marking, on rails",
    template: "%s · MarkFlow",
  },
  description:
    "The teacher's marking rhythm. Plan formative checks so you never mark two classes at once and never miss a two-week feedback window.",
  applicationName: "MarkFlow",
};

export const viewport: Viewport = {
  themeColor: "#211D17",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  viewportFit: "cover",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">
        <NativeBridge />
        <NotificationBridge />
        {children}
      </body>
    </html>
  );
}
