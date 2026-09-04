"use client";

import { useActionState } from "react";
import { TriangleAlert, Wand2 } from "lucide-react";
import { loginAction, loginDemoAction, signupAction, type AuthState } from "@/actions/auth";
import { Spinner } from "@/components/ui";

const initial: AuthState = undefined;

export function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const action = mode === "login" ? loginAction : signupAction;
  const [state, formAction, pending] = useActionState(action, initial);
  const [demoState, demoAction, demoPending] = useActionState(loginDemoAction, initial);

  const error = state?.error ?? demoState?.error;

  return (
    <div className="mt-8">
      {error ? (
        <p className="pop mb-4 flex items-start gap-2 rounded-xl bg-bad-soft px-4 py-3 text-sm font-medium text-bad">
          <TriangleAlert size={16} className="mt-0.5 shrink-0" />
          {error}
        </p>
      ) : null}

      <form action={formAction} className="space-y-4">
        {mode === "signup" ? (
          <div>
            <label className="label" htmlFor="name">
              Your name
            </label>
            <input id="name" name="name" className="input" placeholder="Alex Morgan" required minLength={2} />
          </div>
        ) : null}
        <div>
          <label className="label" htmlFor="email">
            School email
          </label>
          <input
            id="email"
            name="email"
            type="email"
            className="input"
            placeholder="a.morgan@school.edu"
            required
            autoComplete="email"
          />
        </div>
        <div>
          <label className="label" htmlFor="password">
            Password
          </label>
          <input
            id="password"
            name="password"
            type="password"
            className="input"
            placeholder={mode === "signup" ? "At least 8 characters" : "Your password"}
            required
            minLength={8}
            autoComplete={mode === "login" ? "current-password" : "new-password"}
          />
        </div>
        <button type="submit" className="btn btn-ink w-full !py-3 !text-[0.85rem]" disabled={pending}>
          {pending ? <Spinner /> : null}
          {mode === "login" ? "Sign in" : "Create my account"}
        </button>
      </form>

      {mode === "login" ? (
        <>
          <div className="my-6 flex items-center gap-3 text-xs font-semibold uppercase tracking-widest text-ink-faint">
            <hr className="divider flex-1" /> or <hr className="divider flex-1" />
          </div>
          <form action={demoAction}>
            <button type="submit" className="btn btn-ghost w-full !py-3 !text-[0.85rem]" disabled={demoPending}>
              {demoPending ? <Spinner /> : <Wand2 size={15} />}
              Explore the demo — Alex Morgan&apos;s timetable
            </button>
          </form>
          <p className="mt-3 text-center text-xs leading-relaxed text-ink-faint">
            A fully-seeded science department: live marking, a class due today, and the next
            fortnight already planned.
          </p>
        </>
      ) : null}
    </div>
  );
}
