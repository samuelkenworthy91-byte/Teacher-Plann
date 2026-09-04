import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { CalendarCheck2, Layers, Timer } from "lucide-react";
import { Logo } from "@/components/ui";
import { getCurrentUser } from "@/lib/auth";

export default async function AuthLayout({ children }: { children: ReactNode }) {
  const user = await getCurrentUser();
  if (user) redirect("/dashboard");

  return (
    <div className="grid min-h-screen lg:grid-cols-[1.05fr_1fr]">
      {/* Brand / art panel */}
      <aside className="relative hidden overflow-hidden bg-dark text-cream lg:flex lg:flex-col">
        <div
          className="absolute inset-0 opacity-45"
          style={{
            backgroundImage: "url(/images/login-art.jpg)",
            backgroundSize: "cover",
            backgroundPosition: "center",
          }}
        />
        <div className="absolute inset-0 bg-gradient-to-b from-dark/70 via-dark/55 to-dark/90" />
        <div className="relative z-10 flex h-full flex-col justify-between p-10">
          <Logo dark />
          <div className="max-w-md">
            <p className="font-display text-[2.6rem] font-semibold leading-[1.06] tracking-tight">
              Marking, <em className="italic text-pen" style={{ color: "#f3b29d" }}>on rails.</em>
            </p>
            <p className="mt-4 text-[0.95rem] leading-relaxed text-cream/75">
              Snap your timetable once. MarkFlow tells you which class to collect, exactly how many
              books to mark each day, and when to hand them back — so you never drown in two sets
              at once.
            </p>
            <ul className="mt-8 space-y-3 text-sm text-cream/85">
              {[
                { icon: CalendarCheck2, text: "Formative checks auto-planned every 4–8 lessons" },
                { icon: Timer, text: "Never more than two weeks between hand-backs" },
                { icon: Layers, text: "Only ever one set of books on your desk" },
              ].map(({ icon: Icon, text }) => (
                <li key={text} className="flex items-center gap-3">
                  <span className="grid h-8 w-8 place-items-center rounded-lg bg-cream/10">
                    <Icon size={16} />
                  </span>
                  {text}
                </li>
              ))}
            </ul>
          </div>
          <p className="text-xs tracking-wide text-cream/50">
            Built for teachers who would rather teach than chase piles of books.
          </p>
        </div>
      </aside>

      {/* Form panel */}
      <main className="flex min-h-screen flex-col px-6 py-8 sm:px-12">
        <div className="lg:hidden">
          <Logo />
        </div>
        <div className="flex flex-1 items-center justify-center py-10">
          <div className="w-full max-w-sm">{children}</div>
        </div>
        <p className="text-center text-xs text-ink-faint">
          MarkFlow — the teacher&apos;s marking rhythm.
        </p>
      </main>
    </div>
  );
}
