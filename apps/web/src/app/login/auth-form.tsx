"use client";

import Link from "next/link";
import { useActionState } from "react";
import { signInAction, signUpAction } from "./actions";

export function AuthForm({ mode }: { mode: "sign-in" | "sign-up" }) {
  const action = mode === "sign-in" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, undefined);

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="auth-title">
        <p className="eyebrow">SALE SAYAR AI · SELLER WORKSPACE</p>
        <h1 id="auth-title">{mode === "sign-in" ? "Welcome back" : "Create your seller account"}</h1>
        <p className="auth-description">
          Sign in to your private workspace or create an account to set up a shop.
        </p>
        <form action={formAction} className="auth-form">
          {mode === "sign-up" && (
            <label>
              Your name
              <input name="display_name" autoComplete="name" required maxLength={120} />
            </label>
          )}
          <label>
            Email address
            <input name="email" type="email" autoComplete="email" required maxLength={254} />
          </label>
          <label>
            Password
            <input
              name="password"
              type="password"
              autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
              minLength={8}
              maxLength={128}
              required
            />
          </label>
          {state?.error && <p className="auth-message error" role="alert">{state.error}</p>}
          {state?.success && <p className="auth-message success" role="status">{state.success}</p>}
          <button className="auth-submit" type="submit" disabled={pending}>
            {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Create account"}
          </button>
        </form>
        <p className="auth-switch">
          {mode === "sign-in" ? "New to SaleSayar AI? " : "Already have an account? "}
          <Link href={mode === "sign-in" ? "/login/signup" : "/login"}>
            {mode === "sign-in" ? "Create an account" : "Sign in"}
          </Link>
        </p>
        <Link className="auth-back" href="/">Return to sample dashboard</Link>
      </section>
    </main>
  );
}
