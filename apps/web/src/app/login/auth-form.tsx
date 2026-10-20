"use client";

import Link from "next/link";
import { useActionState } from "react";
import { googleSignInAction, signInAction, signUpAction } from "./actions";

export function AuthForm({ mode, notice, next = "/workspace", showGoogle = true, showRecovery = true, showSignUp = true, showBack = true }: { mode: "sign-in" | "sign-up"; notice?: string; next?: string; showGoogle?: boolean; showRecovery?: boolean; showSignUp?: boolean; showBack?: boolean }) {
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
        {notice && <p className="auth-message" role="status">{notice}</p>}
        {showGoogle && <form action={googleSignInAction}>
          <input type="hidden" name="next" value={next}/>
          <button className="auth-submit" type="submit">Continue with Google</button>
        </form>}
        {showGoogle && <p className="auth-description">Or continue with email and password</p>}
        <form action={formAction} className="auth-form">
          <input type="hidden" name="next" value={next}/>
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
        {showRecovery && mode === "sign-in" && <Link className="auth-back" href="/login/forgot-password">Forgot password?</Link>}
        {showSignUp && <p className="auth-switch">
          {mode === "sign-in" ? "New to SaleSayar AI? " : "Already have an account? "}
          <Link href={`${mode === "sign-in" ? "/login/signup" : "/login"}?${new URLSearchParams({ next })}`}>
            {mode === "sign-in" ? "Create an account" : "Sign in"}
          </Link>
        </p>}
        {showBack && <Link className="auth-back" href="/">Return to sample dashboard</Link>}
      </section>
    </main>
  );
}
