import type { Metadata } from "next";
import type { ReactNode } from "react";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "MarkFlow — Marking, on rails",
    template: "%s · MarkFlow",
  },
  description:
    "The teacher's marking rhythm. Plan formative checks so you never mark two classes at once and never miss a two-week feedback window.",
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
