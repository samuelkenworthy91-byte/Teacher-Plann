import type { Metadata, Viewport } from "next";
import type { ReactNode } from "react";
import { Fraunces, Inter } from "next/font/google";
import "./globals.css";

const display = Fraunces({
  subsets: ["latin"],
  variable: "--font-fraunces",
  style: ["normal", "italic"],
  weight: ["400", "500", "600", "700"],
});

const sans = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
});

export const metadata: Metadata = {
  title: {
    default: "MarkFlow — Marking, on rails",
    template: "%s · MarkFlow",
  },
  description:
    "The teacher's marking rhythm. Plan formative checks so you never mark two classes at once and never miss a two-week feedback window.",
  appleWebApp: {
    capable: true,
    title: "MarkFlow",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  themeColor: "#d9481f",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${display.variable} ${sans.variable}`}>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
