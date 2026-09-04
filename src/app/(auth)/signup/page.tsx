import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Create account" };

export default function SignupPage() {
  return (
    <div className="rise">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Take the evenings back
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        One timetable photo, a few classes — and a plan that keeps every feedback promise for you.
      </p>
      <AuthForm mode="signup" />
      <p className="mt-6 text-center text-sm text-ink-soft">
        Already have an account?{" "}
        <Link href="/login" className="font-semibold text-pen hover:underline">
          Sign in
        </Link>
      </p>
    </div>
  );
}
