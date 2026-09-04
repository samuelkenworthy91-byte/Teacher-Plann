import type { Metadata } from "next";
import Link from "next/link";
import { AuthForm } from "@/components/auth-form";

export const metadata: Metadata = { title: "Sign in" };

export default function LoginPage() {
  return (
    <div className="rise">
      <h1 className="font-display text-3xl font-semibold tracking-tight text-ink">
        Welcome back
      </h1>
      <p className="mt-2 text-sm leading-relaxed text-ink-soft">
        Your pile is exactly where you left it — and it&apos;s smaller than you think.
      </p>
      <AuthForm mode="login" />
      <p className="mt-6 text-center text-sm text-ink-soft">
        New here?{" "}
        <Link href="/signup" className="font-semibold text-pen hover:underline">
          Create an account
        </Link>
      </p>
    </div>
  );
}
