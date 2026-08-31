"use client";

import { useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Bell,
  CalendarRange,
  Flame,
  LayoutDashboard,
  Menu,
  PenLine,
  SlidersHorizontal,
  Sparkles,
  Users,
  X,
} from "lucide-react";
import { Logo, Dot } from "@/components/ui";
import type { Notice } from "@/lib/engine";

const NAV = [
  { href: "/dashboard", label: "Today", icon: LayoutDashboard },
  { href: "/classes", label: "My Classes", icon: Users },
  { href: "/timetable", label: "Timetable", icon: CalendarRange },
  { href: "/planner", label: "Smart Planner", icon: Sparkles },
  { href: "/marking", label: "Marking", icon: PenLine },
  { href: "/settings", label: "Settings", icon: SlidersHorizontal },
];

const TONE_COLOR: Record<Notice["tone"], string> = {
  pen: "var(--color-pen)",
  warn: "var(--color-warn)",
  bad: "var(--color-bad)",
  good: "var(--color-good)",
  ink: "var(--color-ink-soft)",
};

export function Shell({
  userName,
  notices,
  activeCount,
  dateLabel,
  children,
}: {
  userName: string;
  notices: Notice[];
  activeCount: number;
  dateLabel: string;
  children: ReactNode;
}) {
  const pathname = usePathname();
  const [drawer, setDrawer] = useState(false);
  const [bellOpen, setBellOpen] = useState(false);

  const urgent = notices.filter((n) => n.tone !== "good").length;
  const initials = userName
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const nav = (
    <nav className="flex flex-1 flex-col gap-1 px-4">
      {NAV.map(({ href, label, icon: Icon }) => {
        const active = pathname.startsWith(href);
        return (
          <Link
            key={href}
            href={href}
            onClick={() => setDrawer(false)}
            className={`group flex items-center gap-3 rounded-xl px-3.5 py-2.5 text-[0.83rem] font-medium transition-colors ${
              active ? "bg-cream/12 text-cream" : "text-cream/55 hover:bg-cream/8 hover:text-cream"
            }`}
          >
            <Icon size={17} strokeWidth={2.2} className={active ? "text-pen" : ""} style={active ? { color: "#f0916f" } : undefined} />
            <span className="flex-1">{label}</span>
            {href === "/marking" && activeCount > 0 ? (
              <span className="rounded-full bg-pen px-2 py-0.5 text-[0.66rem] font-bold text-white">
                {activeCount}
              </span>
            ) : null}
          </Link>
        );
      })}
    </nav>
  );

  const userCard = (
    <div className="border-t border-cream/10 p-4">
      <div className="flex items-center gap-3 rounded-xl px-2 py-1.5">
        <span className="grid h-9 w-9 place-items-center rounded-full bg-pen text-xs font-bold text-white">
          {initials}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-cream">{userName}</p>
          <p className="text-[0.7rem] text-cream/45">Saved on this device</p>
        </div>
        <Link
          href="/settings"
          onClick={() => setDrawer(false)}
          className="rounded-lg p-2 text-cream/50 transition-colors hover:bg-cream/10 hover:text-cream"
          title="Settings"
        >
          <SlidersHorizontal size={16} />
        </Link>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen">
      {/* Desktop sidebar */}
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-[264px] flex-col bg-dark py-6 lg:flex">
        <div className="px-7 pb-7">
          <Logo dark />
        </div>
        {nav}
        <div className="mt-6 px-7 text-[0.68rem] leading-relaxed text-cream/35">
          One pile at a time.
          <br />
          Every class, every fortnight.
        </div>
        <div className="flex-1" />
        {userCard}
      </aside>

      {/* Mobile drawer */}
      {drawer ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <div className="absolute inset-0 bg-ink/50 backdrop-blur-[2px]" onClick={() => setDrawer(false)} />
          <aside className="pop absolute inset-y-0 left-0 flex w-[272px] flex-col bg-dark py-6 shadow-2xl">
            <div className="flex items-center justify-between px-7 pb-7">
              <Logo dark />
              <button className="rounded-lg p-1.5 text-cream/60 hover:bg-cream/10" onClick={() => setDrawer(false)}>
                <X size={18} />
              </button>
            </div>
            {nav}
            <div className="flex-1" />
            {userCard}
          </aside>
        </div>
      ) : null}

      {/* Main column */}
      <div className="lg:pl-[264px]">
        {/* Topbar */}
        <header className="sticky top-0 z-20 border-b border-line bg-paper/85 backdrop-blur-md">
          <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
            <button
              className="btn btn-quiet -ml-2 !p-2 lg:hidden"
              onClick={() => setDrawer(true)}
              aria-label="Open menu"
            >
              <Menu size={20} />
            </button>
            <div className="flex-1">
              <p className="hidden text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-faint sm:block">
                {dateLabel}
              </p>
              <p className="text-[0.7rem] font-bold uppercase tracking-[0.14em] text-ink-faint lg:hidden">
                MarkFlow
              </p>
            </div>

            {/* Bell */}
            <div className="relative">
              <button
                className="relative rounded-full border border-line-strong bg-card p-2.5 text-ink-soft transition-colors hover:text-ink"
                onClick={() => setBellOpen((v) => !v)}
                aria-label="Notifications"
              >
                <Bell size={17} />
                {urgent > 0 ? (
                  <span className="absolute -right-0.5 -top-0.5 grid h-4.5 min-w-4.5 place-items-center rounded-full bg-pen px-1 text-[0.6rem] font-bold text-white" style={{ height: 18, minWidth: 18 }}>
                    {urgent}
                  </span>
                ) : null}
              </button>

              {bellOpen ? (
                <>
                  <button className="fixed inset-0 z-40 cursor-default" onClick={() => setBellOpen(false)} aria-hidden />
                  <div className="pop card absolute right-0 z-50 mt-2 w-[min(92vw,380px)] overflow-hidden p-0">
                    <div className="flex items-center gap-2 border-b border-line bg-cream/50 px-4 py-3">
                      <Flame size={14} className="text-pen" />
                      <p className="text-[0.72rem] font-bold uppercase tracking-[0.12em] text-ink-soft">
                        Your marking radar
                      </p>
                    </div>
                    <ul className="max-h-[60vh] overflow-y-auto">
                      {notices.map((n) => (
                        <li key={n.id} className="flex gap-3 border-b border-line px-4 py-3.5 last:border-0">
                          <Dot color={TONE_COLOR[n.tone]} size={9} />
                          <div className="min-w-0">
                            <p className="text-[0.83rem] font-semibold leading-snug text-ink">{n.title}</p>
                            <p className="mt-0.5 text-[0.76rem] leading-relaxed text-ink-soft">{n.body}</p>
                          </div>
                        </li>
                      ))}
                    </ul>
                  </div>
                </>
              ) : null}
            </div>
          </div>
        </header>

        <main className="mx-auto w-full max-w-6xl px-4 pb-20 pt-8 sm:px-6">{children}</main>
      </div>
    </div>
  );
}
