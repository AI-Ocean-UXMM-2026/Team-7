"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState, useState } from "react";
import { googleSignInAction, signInAction, signUpAction } from "./actions";

export function AuthForm({
  mode,
  notice,
  next = "/workspace",
  showGoogle = true,
  showRecovery = true,
  showSignUp = true,
  showBack = true,
}: {
  mode: "sign-in" | "sign-up";
  notice?: string;
  next?: string;
  showGoogle?: boolean;
  showRecovery?: boolean;
  showSignUp?: boolean;
  showBack?: boolean;
}) {
  const action = mode === "sign-in" ? signInAction : signUpAction;
  const [state, formAction, pending] = useActionState(action, undefined);
  const [showPassword, setShowPassword] = useState(false);

  return (
    <main className="mobbin-auth-wrapper">
      <div className="mobbin-auth-card">
        {/* Left Side: Modern Form */}
        <div className="mobbin-form-panel">
          {/* Serif Title (No logo above Welcome back) */}
          <div className="mobbin-header-clean">
            <h1 className="mobbin-title-serif">
              {mode === "sign-in" ? "Welcome back" : "Create your account"}
            </h1>
          </div>

          {notice && (
            <div className="auth-message info" role="status" style={{ marginBottom: "0.85rem" }}>
              {notice}
            </div>
          )}

          {/* Google Sign-in - Clean Card (Only existing button, no Apple/SSO) */}
          {showGoogle && (
            <form action={googleSignInAction}>
              <input type="hidden" name="next" value={next} />
              <button className="mobbin-google-card-btn" type="submit">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
                  <path
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                    fill="#4285F4"
                  />
                  <path
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                    fill="#34A853"
                  />
                  <path
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                    fill="#FBBC05"
                  />
                  <path
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                    fill="#EA4335"
                  />
                </svg>
                <span>Continue with Google</span>
              </button>
            </form>
          )}

          {showGoogle && (
            <div className="mobbin-divider-clean">
              <span>Or sign in with email</span>
            </div>
          )}

          {/* Form with Boxed Inputs */}
          <form action={formAction} className="mobbin-form-clean">
            <input type="hidden" name="next" value={next} />

            {mode === "sign-up" && (
              <div className="mobbin-field-box">
                <label htmlFor="display_name" className="mobbin-box-label">Name</label>
                <input
                  id="display_name"
                  className="mobbin-box-input"
                  name="display_name"
                  autoComplete="name"
                  placeholder="Ma May Thu"
                  required
                  maxLength={120}
                />
              </div>
            )}

            <div className="mobbin-field-box">
              <label htmlFor="email" className="mobbin-box-label">E-mail</label>
              <input
                id="email"
                className="mobbin-box-input"
                name="email"
                type="email"
                autoComplete="email"
                placeholder="samlee.mobbin@gmail.com"
                required
                maxLength={254}
              />
            </div>

            <div className="mobbin-field-box">
              <div className="mobbin-box-label-row">
                <label htmlFor="password" className="mobbin-box-label">Password</label>
                <button
                  type="button"
                  className="mobbin-eye-toggle"
                  onClick={() => setShowPassword(!showPassword)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24" />
                      <line x1="1" y1="1" x2="23" y2="23" />
                    </svg>
                  ) : (
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
                      <circle cx="12" cy="12" r="3" />
                    </svg>
                  )}
                </button>
              </div>
              <input
                id="password"
                className="mobbin-box-input"
                name="password"
                type={showPassword ? "text" : "password"}
                autoComplete={mode === "sign-in" ? "current-password" : "new-password"}
                placeholder="••••••••••••"
                minLength={8}
                maxLength={128}
                required
              />
            </div>

            {showRecovery && mode === "sign-in" && (
              <div className="mobbin-forgot-wrap">
                <Link className="mobbin-forgot-link-center" href="/login/forgot-password">
                  Forgot your password?
                </Link>
              </div>
            )}

            {state?.error && (
              <p className="auth-message error" role="alert" style={{ margin: "0.2rem 0" }}>
                {state.error}
              </p>
            )}
            {state?.success && (
              <p className="auth-message success" role="status" style={{ margin: "0.2rem 0" }}>
                {state.success}
              </p>
            )}

            <button className="mobbin-submit-btn-dark" type="submit" disabled={pending}>
              {pending ? "Please wait…" : mode === "sign-in" ? "Sign in" : "Sign up"}
            </button>
          </form>

          {showSignUp && (
            <p className="mobbin-switch-text-clean">
              {mode === "sign-in" ? "Don’t have an account yet? " : "Already have an account? "}
              <Link href={`${mode === "sign-in" ? "/login/signup" : "/login"}?${new URLSearchParams({ next })}`}>
                {mode === "sign-in" ? "Sign up" : "Sign in"}
              </Link>
            </p>
          )}

          {showBack && (
            <Link className="mobbin-forgot-link-center" href="/demo" style={{ display: "block", textAlign: "center", marginTop: "0.65rem", fontSize: "0.76rem" }}>
              Explore sample demonstration dashboard ↗
            </Link>
          )}
        </div>

        {/* Right Side: Ocean Blue Panel with Centered Dolphin & Animated Water Waves */}
        <div className="mobbin-showcase-panel">
          <div>
            {/* Dolphin Animation with Water Under it in the Middle */}
            <div className="mobbin-water-stage">
              <Image
                src="/dolphin-accountant.png"
                alt="တူတူတွက်မယ် Dolphin"
                width={138}
                height={138}
                className="mobbin-water-dolphin"
                priority
              />
              <div className="mobbin-water-waves" aria-hidden="true">
                <span className="wave wave-1" />
                <span className="wave wave-2" />
                <span className="wave wave-3" />
              </div>
            </div>

            {/* Checklist of Functions */}
            <ul className="mobbin-checklist">
              <li className="mobbin-checklist-item">
                <svg className="mobbin-check-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="rgba(255,255,255,0.12)" />
                  <path d="M6.5 10.2L8.8 12.5L13.5 7.8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong>Floating AI Assistant</strong> — Extract orders from chat screenshots
                </span>
              </li>

              <li className="mobbin-checklist-item">
                <svg className="mobbin-check-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="rgba(255,255,255,0.12)" />
                  <path d="M6.5 10.2L8.8 12.5L13.5 7.8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong>Slip OCR Verification</strong> — Match KBZPay, WavePay &amp; bank slips
                </span>
              </li>

              <li className="mobbin-checklist-item">
                <svg className="mobbin-check-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="rgba(255,255,255,0.12)" />
                  <path d="M6.5 10.2L8.8 12.5L13.5 7.8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong>Auto Voucher Generator</strong> — Instant printable receipts with revision history
                </span>
              </li>

              <li className="mobbin-checklist-item">
                <svg className="mobbin-check-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="rgba(255,255,255,0.12)" />
                  <path d="M6.5 10.2L8.8 12.5L13.5 7.8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong>Accurate Net Profit</strong> — Track MMK sales revenue, costs &amp; expenses
                </span>
              </li>

              <li className="mobbin-checklist-item">
                <svg className="mobbin-check-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="rgba(255,255,255,0.12)" />
                  <path d="M6.5 10.2L8.8 12.5L13.5 7.8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong>Team Workspace Sharing</strong> — Invite shop managers, accountants &amp; staff
                </span>
              </li>

              <li className="mobbin-checklist-item">
                <svg className="mobbin-check-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="rgba(255,255,255,0.12)" />
                  <path d="M6.5 10.2L8.8 12.5L13.5 7.8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong>Safe Receiving Wallets</strong> — Protect customer payments with verified accounts
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
