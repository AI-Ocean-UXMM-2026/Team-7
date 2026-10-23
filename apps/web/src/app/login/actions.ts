"use server";

import crypto from "node:crypto";
import { createShopSchema, receivingAccountInputSchema, recoveryEmailSchema, resetPasswordSchema, signInSchema, signUpSchema } from "@ocean/contracts";
import { headers } from "next/headers.js";
import { redirect } from "next/navigation.js";
import { createClient } from "../../lib/supabase/server.ts";
import { isSupabaseConfigured } from "../../lib/supabase/config.ts";
import { authDestination, getAppUrl, shopDestination } from "../../lib/auth.ts";
import { clearSessionCookie, createSessionCookie, getCurrentSession } from "../../lib/auth/session.ts";
import { getDb } from "../../lib/db/sqlite.ts";
import { hashPassword, verifyPassword } from "../../lib/auth/password.ts";
import { ensureLocalProfile } from "../../lib/auth/local-profile.ts";

export type FormActionState = { error?: string; success?: string } | undefined;

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
}

async function getDynamicAppUrl(): Promise<string> {
  try {
    const h = await headers();
    const host = h.get("x-forwarded-host") || h.get("host");
    const proto =
      h.get("x-forwarded-proto") ||
      (host?.includes("localhost") || host?.includes("127.0.0.1") ? "http" : "https");
    if (host) {
      return getAppUrl(`${proto}://${host}`);
    }
  } catch {
    // outside request context or testing
  }
  return getAppUrl();
}

export async function signInAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = signInSchema.safeParse({
    email: readText(formData, "email"),
    password: readText(formData, "password"),
  });
  if (!parsed.success) return { error: "Enter a valid email and password (at least 8 characters)." };

  const nextPath = authDestination(readText(formData, "next"));
  const emailClean = parsed.data.email.toLowerCase().trim();
  const db = getDb();

  // 1. Authenticate through supported provider if configured
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const { data, error } = await supabase.auth.signInWithPassword({
        email: emailClean,
        password: parsed.data.password,
      });

      if (!error && data.user) {
        const { shopId, displayName } = ensureLocalProfile({
          id: data.user.id,
          email: data.user.email,
          user_metadata: data.user.user_metadata,
        });

        try {
          const passHash = hashPassword(parsed.data.password);
          db.prepare("UPDATE profiles SET password_hash = ? WHERE id = ?").run(passHash, data.user.id);
        } catch {}

        await createSessionCookie(data.user.id, undefined, {
          email: data.user.email ?? undefined,
          displayName,
        });
        const target = nextPath === "/workspace" ? `/?shop=${shopId}` : nextPath;
        redirect(target);
      }

      // Give a specific message when the email hasn't been confirmed yet
      if (
        error?.message?.toLowerCase().includes("email not confirmed") ||
        error?.message?.toLowerCase().includes("not confirmed")
      ) {
        return { error: "Please confirm your email first. Check your inbox for the confirmation link we sent when you signed up, or use Google sign-in." };
      }
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")) {
        throw e;
      }
    }
  }

  // 2. Local profile verification: checks accounts with cryptographic scrypt validation
  const profile = db.prepare("SELECT id, email, display_name, password_hash, status FROM profiles WHERE lower(email) = lower(?)").get(emailClean) as
    | { id: string; email: string; display_name: string; password_hash: string | null; status?: string | null }
    | undefined;

  if (profile) {
    if (profile.status === "disabled" || profile.status === "revoked") {
      return { error: "This account has been disabled." };
    }

    if (!profile.password_hash) {
      return { error: "This account was created with Google. Please click 'Continue with Google' above to sign in." };
    }

    const passwordValid = verifyPassword(parsed.data.password, profile.password_hash);
    if (!passwordValid) {
      return { error: "Invalid email or password." };
    }

    const { shopId, displayName } = ensureLocalProfile({
      id: profile.id,
      email: profile.email,
      user_metadata: { display_name: profile.display_name },
    });
    await createSessionCookie(profile.id, undefined, {
      email: profile.email,
      displayName,
    });
    const target = nextPath === "/workspace" ? `/?shop=${shopId}` : nextPath;
    redirect(target);
  }

  return { error: "Invalid email or password." };
}

export async function signUpAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = signUpSchema.safeParse({
    display_name: readText(formData, "display_name"),
    email: readText(formData, "email"),
    password: readText(formData, "password"),
  });
  if (!parsed.success) return { error: "Enter your name, a valid email, and a password of at least 8 characters." };

  const nextPath = authDestination(readText(formData, "next"));
  const emailClean = parsed.data.email.toLowerCase().trim();
  const db = getDb();

  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      const appUrl = await getDynamicAppUrl();
      const { data, error } = await supabase.auth.signUp({
        email: emailClean,
        password: parsed.data.password,
        options: {
          data: { display_name: parsed.data.display_name },
          emailRedirectTo: `${appUrl}/auth/confirm?${new URLSearchParams({ next: nextPath })}`,
        },
      });

      // If user ID was returned by Supabase, establish session immediately
      if (data?.user?.id) {
        const { shopId, displayName } = ensureLocalProfile({
          id: data.user.id,
          email: emailClean,
          user_metadata: { display_name: parsed.data.display_name || data.user.user_metadata?.display_name },
        });

        try {
          const passHash = hashPassword(parsed.data.password);
          db.prepare("UPDATE profiles SET password_hash = ? WHERE id = ?").run(passHash, data.user.id);
        } catch {}

        await createSessionCookie(data.user.id, undefined, {
          email: emailClean,
          displayName,
        });
        const target = nextPath === "/workspace" ? `/?shop=${shopId}` : nextPath;
        redirect(target);
      }

      // If account already exists in Supabase
      if (error?.message?.toLowerCase().includes("already registered") || error?.message?.toLowerCase().includes("already exists")) {
        // Try to log in with the password provided
        const loginRes = await supabase.auth.signInWithPassword({
          email: emailClean,
          password: parsed.data.password,
        });

        if (loginRes.data?.user) {
          const { shopId, displayName } = ensureLocalProfile({
            id: loginRes.data.user.id,
            email: emailClean,
            user_metadata: loginRes.data.user.user_metadata,
          });

          try {
            const passHash = hashPassword(parsed.data.password);
            db.prepare("UPDATE profiles SET password_hash = ? WHERE id = ?").run(passHash, loginRes.data.user.id);
          } catch {}

          await createSessionCookie(loginRes.data.user.id, undefined, {
            email: emailClean,
            displayName,
          });
          const target = nextPath === "/workspace" ? `/?shop=${shopId}` : nextPath;
          redirect(target);
        }

        // Check local profile
        const localUser = db.prepare(
          "SELECT id, email, display_name, password_hash, status FROM profiles WHERE lower(email) = lower(?)"
        ).get(emailClean) as { id: string; email: string; display_name: string; password_hash: string | null; status?: string | null } | undefined;

        if (localUser) {
          if (!localUser.password_hash) {
            // User registered via Google OAuth; set their password now so they can log in either way!
            const passHash = hashPassword(parsed.data.password);
            const now = new Date().toISOString();
            db.prepare("UPDATE profiles SET password_hash = ?, display_name = CASE WHEN display_name IS NULL OR display_name = '' THEN ? ELSE display_name END, updated_at = ? WHERE id = ?").run(passHash, parsed.data.display_name, now, localUser.id);

            const { shopId, displayName } = ensureLocalProfile({
              id: localUser.id,
              email: localUser.email,
              user_metadata: { display_name: parsed.data.display_name || localUser.display_name },
            });
            await createSessionCookie(localUser.id, undefined, {
              email: localUser.email,
              displayName,
            });
            const target = nextPath === "/workspace" ? `/?shop=${shopId}` : nextPath;
            redirect(target);
          } else if (verifyPassword(parsed.data.password, localUser.password_hash)) {
            // Password matches local account! Log in!
            const { shopId, displayName } = ensureLocalProfile({
              id: localUser.id,
              email: localUser.email,
              user_metadata: { display_name: localUser.display_name },
            });
            await createSessionCookie(localUser.id, undefined, {
              email: localUser.email,
              displayName,
            });
            const target = nextPath === "/workspace" ? `/?shop=${shopId}` : nextPath;
            redirect(target);
          }
        }

        return {
          error: "An account with this email already exists. Sign in with your password, or use 'Continue with Google' if you registered via Google.",
        };
      }

      if (error) {
        return { error: error.message || "Account creation failed. Please try again." };
      }
    } catch (e: unknown) {
      if (typeof e === "object" && e !== null && "digest" in e && typeof (e as { digest: unknown }).digest === "string" && (e as { digest: string }).digest.startsWith("NEXT_REDIRECT")) throw e;
      return { error: "Account creation failed. Try again later." };
    }
  }

  // 3. Local signup with properly hashed password (scrypt + salt)
  const existing = db.prepare("SELECT id, email, display_name, password_hash, status FROM profiles WHERE lower(email) = lower(?)").get(emailClean) as
    | { id: string; email: string; display_name: string; password_hash: string | null; status?: string | null }
    | undefined;

  if (existing) {
    if (!existing.password_hash) {
      // Account exists without password (e.g. Google OAuth); set password and log in
      const passwordHash = hashPassword(parsed.data.password);
      const now = new Date().toISOString();
      db.prepare("UPDATE profiles SET password_hash = ?, display_name = CASE WHEN display_name IS NULL OR display_name = '' THEN ? ELSE display_name END, updated_at = ? WHERE id = ?").run(passwordHash, parsed.data.display_name, now, existing.id);

      const { shopId, displayName } = ensureLocalProfile({
        id: existing.id,
        email: existing.email,
        user_metadata: { display_name: parsed.data.display_name || existing.display_name },
      });
      await createSessionCookie(existing.id, undefined, {
        email: existing.email,
        displayName,
      });
      const target = nextPath === "/workspace" ? `/?shop=${shopId}` : nextPath;
      redirect(target);
    }

    if (verifyPassword(parsed.data.password, existing.password_hash)) {
      // Password matches! Log in!
      const { shopId, displayName } = ensureLocalProfile({
        id: existing.id,
        email: existing.email,
        user_metadata: { display_name: existing.display_name },
      });
      await createSessionCookie(existing.id, undefined, {
        email: existing.email,
        displayName,
      });
      const target = nextPath === "/workspace" ? `/?shop=${shopId}` : nextPath;
      redirect(target);
    }

    return { error: "An account with this email already exists. Sign in with your password, or use 'Forgot your password?'." };
  }

  const userId = crypto.randomUUID();
  const now = new Date().toISOString();
  const passwordHash = hashPassword(parsed.data.password);

  db.prepare(`
    INSERT INTO profiles (id, email, display_name, role, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(userId, emailClean, parsed.data.display_name, "owner", passwordHash, now, now);

  // Create user's first shop
  const shopId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO shops (id, name, currency, is_sample, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(shopId, `${parsed.data.display_name}’s Shop`, "MMK", 0, now, now);

  db.prepare(`
    INSERT INTO shop_memberships (shop_id, user_id, role, created_at)
    VALUES (?, ?, ?, ?)
  `).run(shopId, userId, "owner", now);

  await createSessionCookie(userId, undefined, {
    email: emailClean,
    displayName: parsed.data.display_name,
  });
  redirect(shopDestination(nextPath, shopId));
}

export async function googleSignInAction(formData: FormData): Promise<void> {
  const next = authDestination(readText(formData, "next"));
  const failure = (reason?: string) =>
    `/login?${new URLSearchParams({ auth: "failed", ...(reason ? { reason } : {}), next })}`;
  if (!isSupabaseConfigured()) redirect(`/login?${new URLSearchParams({ auth: "configuration", next })}`);
  const supabase = await createClient();
  const appUrl = await getDynamicAppUrl();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: {
      redirectTo: `${appUrl}/auth/confirm?${new URLSearchParams({ next })}`,
      queryParams: {
        prompt: "select_account",
      },
    },
  });
  if (error || !data.url) {
    console.error("Google OAuth initiation error:", error);
    redirect(failure(error?.message || "oauth-failed"));
  }
  if (new URL(data.url).origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin) {
    redirect(failure("Origin mismatch"));
  }
  redirect(data.url);
}

export async function requestRecoveryAction(
  _previous: FormActionState, formData: FormData,
): Promise<FormActionState> {
  const parsed = recoveryEmailSchema.safeParse({ email: readText(formData, "email") });
  if (!parsed.success) return { error: "Enter a valid email address." };
  if (!isSupabaseConfigured()) return { error: "Supabase setup is incomplete." };
  const supabase = await createClient();
  const appUrl = await getDynamicAppUrl();
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${appUrl}/auth/confirm?next=/login/reset-password`,
  });
  if (error && (error.status === 429 || error.status === 0 || error.status === undefined || error.status >= 500)) {
    return { error: "Recovery is temporarily unavailable. Please try again later." };
  }
  return { success: "If this account supports password recovery, a reset link will arrive by email. Open it in this browser." };
}

export async function resetPasswordAction(
  _previous: FormActionState, formData: FormData,
): Promise<FormActionState> {
  const parsed = resetPasswordSchema.safeParse({
    password: readText(formData, "password"), confirmation: readText(formData, "confirmation"),
  });
  if (!parsed.success) return { error: "Use matching passwords of 8–128 characters." };
  if (!isSupabaseConfigured()) return { error: "Supabase setup is incomplete." };
  const supabase = await createClient();
  const { data: { user }, error: sessionError } = await supabase.auth.getUser();
  if (sessionError || !user) return { error: "Your reset session expired. Request a new recovery link." };
  const { error } = await supabase.auth.updateUser({ password: parsed.data.password });
  if (error) return { error: "Password could not be updated. Try a different password or request a new link." };
  await supabase.auth.signOut();
  await clearSessionCookie();
  redirect("/login?auth=password-updated");
}

export async function signOutAction() {
  await clearSessionCookie();
  if (isSupabaseConfigured()) {
    try {
      const supabase = await createClient();
      await supabase.auth.signOut();
    } catch {}
  }
  redirect("/login");
}

export async function createShopAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = createShopSchema.safeParse({ name: readText(formData, "name") });
  if (!parsed.success) return { error: "Shop name must be between 2 and 120 characters." };

  const provider = readText(formData, "provider");
  const accountName = readText(formData, "account_name");
  const accountNumber = readText(formData, "account_number");
  const hasReceivingAccount = Boolean(provider || accountName || accountNumber);
  if (hasReceivingAccount && (!provider || !accountName || !accountNumber)) return { error: "Complete all three receiving account fields, or leave them blank for now." };

  const session = await getCurrentSession();
  if (!session) {
    redirect("/login");
  }

  const db = getDb();
  const newShopId = crypto.randomUUID();
  const now = new Date().toISOString();

  const receivingAccount = hasReceivingAccount ? receivingAccountInputSchema.safeParse({ shop_id: newShopId, provider, account_name: accountName, account_number: accountNumber }) : null;
  if (receivingAccount && !receivingAccount.success) return { error: "Enter a valid payment method, account holder, and receiving number." };

  db.exec("BEGIN IMMEDIATE");
  try {
    db.prepare(`
    INSERT INTO shops (id, name, currency, is_sample, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
    `).run(newShopId, parsed.data.name, "MMK", 0, now, now);

    db.prepare(`
    INSERT INTO shop_memberships (shop_id, user_id, role, created_at)
    VALUES (?, ?, ?, ?)
    `).run(newShopId, session.userId, "owner", now);
    if (receivingAccount?.success) db.prepare("INSERT INTO shop_receiving_accounts (id, shop_id, provider, account_name, account_number, created_at) VALUES (?, ?, ?, ?, ?, ?)").run(crypto.randomUUID(), newShopId, receivingAccount.data.provider, receivingAccount.data.account_name, receivingAccount.data.account_number, now);
    db.exec("COMMIT");
  } catch {
    db.exec("ROLLBACK");
    return { error: "Shop setup could not be saved. Please try again." };
  }

  redirect(shopDestination(readText(formData, "next"), newShopId));
}
