"use client";

import Link from "next/link";
import { useActionState } from "react";
import { requestRecoveryAction, resetPasswordAction } from "./actions";

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const [state, action, pending] = useActionState(reset ? resetPasswordAction : requestRecoveryAction, undefined);
  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby="recovery-title">
        <p className="eyebrow">SALE SAYAR AI · ACCOUNT RECOVERY</p>
        <h1 id="recovery-title">{reset ? "Choose a new password" : "Reset your password"}</h1>
        <p className="auth-description">{reset ? "Use a password of at least 8 characters." : "Enter your email to request a reset link. Open the email in the same browser."}</p>
        <form action={action} className="auth-form">
          {reset ? <>
            <label>New password<input name="password" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
            <label>Confirm password<input name="confirmation" type="password" autoComplete="new-password" minLength={8} maxLength={128} required /></label>
          </> : <label>Email address<input name="email" type="email" autoComplete="email" maxLength={254} required /></label>}
          {state?.error && <p className="auth-message error" role="alert">{state.error}</p>}
          {state?.success && <p className="auth-message success" role="status">{state.success}</p>}
          <button type="submit" className="auth-submit" disabled={pending}>{pending ? "Please wait…" : reset ? "Update password" : "Send reset link"}</button>
        </form>
        <Link href="/login" className="auth-back">Back to sign in</Link>
      </section>
    </main>
  );
}
