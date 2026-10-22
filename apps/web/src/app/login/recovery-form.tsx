"use client";

import Link from "next/link";
import Image from "next/image";
import { useActionState } from "react";
import { requestRecoveryAction, resetPasswordAction } from "./actions";

export function RecoveryForm({ reset = false }: { reset?: boolean }) {
  const [state, action, pending] = useActionState(reset ? resetPasswordAction : requestRecoveryAction, undefined);

  return (
    <main className="mobbin-auth-wrapper">
      <div className="mobbin-auth-card">
        {/* Left Side: Form */}
        <div className="mobbin-form-panel">
          <div className="mobbin-header-clean">
            <h1 className="mobbin-title-serif">
              {reset ? "New password" : "Reset password"}
            </h1>
          </div>

          <form action={action} className="mobbin-form-clean">
            {reset ? (
              <>
                <div className="mobbin-field-box">
                  <label htmlFor="password" className="mobbin-box-label">New password</label>
                  <input
                    id="password"
                    className="mobbin-box-input"
                    name="password"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••••••"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </div>
                <div className="mobbin-field-box">
                  <label htmlFor="confirmation" className="mobbin-box-label">Confirm new password</label>
                  <input
                    id="confirmation"
                    className="mobbin-box-input"
                    name="confirmation"
                    type="password"
                    autoComplete="new-password"
                    placeholder="••••••••••••"
                    minLength={8}
                    maxLength={128}
                    required
                  />
                </div>
              </>
            ) : (
              <div className="mobbin-field-box">
                <label htmlFor="email" className="mobbin-box-label">E-mail</label>
                <input
                  id="email"
                  className="mobbin-box-input"
                  name="email"
                  type="email"
                  autoComplete="email"
                  placeholder="samlee.mobbin@gmail.com"
                  maxLength={254}
                  required
                />
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

            <button type="submit" className="mobbin-submit-btn-dark" disabled={pending}>
              {pending ? "Please wait…" : reset ? "Update password" : "Send reset link"}
            </button>
          </form>

          <p className="mobbin-switch-text-clean" style={{ marginTop: "1rem" }}>
            Remembered your credentials?{" "}
            <Link href="/login">Sign in</Link>
          </p>
        </div>

        {/* Right Side: Ocean Blue Showcase with Centered Water Dolphin */}
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

            <ul className="mobbin-checklist">
              <li className="mobbin-checklist-item">
                <svg className="mobbin-check-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="rgba(255,255,255,0.12)" />
                  <path d="M6.5 10.2L8.8 12.5L13.5 7.8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong>Encrypted Authentication</strong> — Protected by crypto hashing
                </span>
              </li>

              <li className="mobbin-checklist-item">
                <svg className="mobbin-check-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="rgba(255,255,255,0.12)" />
                  <path d="M6.5 10.2L8.8 12.5L13.5 7.8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong>Data Preservation</strong> — All shop records &amp; vouchers remain safe
                </span>
              </li>

              <li className="mobbin-checklist-item">
                <svg className="mobbin-check-icon" width="20" height="20" viewBox="0 0 20 20" fill="none">
                  <circle cx="10" cy="10" r="9" stroke="rgba(255,255,255,0.7)" strokeWidth="1.5" fill="rgba(255,255,255,0.12)" />
                  <path d="M6.5 10.2L8.8 12.5L13.5 7.8" stroke="#ffffff" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
                </svg>
                <span>
                  <strong>Session Control</strong> — Past sessions are immediately invalidated
                </span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </main>
  );
}
