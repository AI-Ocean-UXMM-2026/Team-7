"use server";

import { createShopSchema, recoveryEmailSchema, resetPasswordSchema, signInSchema, signUpSchema, uuidSchema } from "@ocean/contracts";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authDestination, getAppUrl, shopDestination } from "@/lib/auth";

export type FormActionState = { error?: string; success?: string } | undefined;

function readText(formData: FormData, name: string) {
  const value = formData.get(name);
  return typeof value === "string" ? value : "";
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
  if (!isSupabaseConfigured()) return { error: "Supabase setup is incomplete. Follow the setup steps in docs/MILESTONE_2A_1.md." };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword(parsed.data);
  if (error) return { error: "Sign in failed. Check your email and password, then try again." };
  redirect(authDestination(readText(formData, "next")));
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
  if (!isSupabaseConfigured()) return { error: "Supabase setup is incomplete. Follow the setup steps in docs/MILESTONE_2A_1.md." };

  const supabase = await createClient();
  const appUrl = getAppUrl();
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.display_name },
      emailRedirectTo: `${appUrl}/auth/confirm?${new URLSearchParams({ next: authDestination(readText(formData, "next")) })}`,
    },
  });
  if (error) return { error: "Account creation failed. Check the details or try signing in." };
  if (data.session) redirect(authDestination(readText(formData, "next")));
  return { success: "Account created. Check your email to confirm, then sign in." };
}

export async function googleSignInAction(formData: FormData): Promise<void> {
  const next = authDestination(readText(formData, "next"));
  const failure = `/login?${new URLSearchParams({ auth: "failed", next })}`;
  if (!isSupabaseConfigured()) redirect(`/login?${new URLSearchParams({ auth: "configuration", next })}`);
  const supabase = await createClient();
  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo: `${getAppUrl()}/auth/confirm?${new URLSearchParams({ next })}` },
  });
  if (error || !data.url) redirect(failure);
  // Only follow the configured Supabase Auth origin, not arbitrary destinations.
  if (new URL(data.url).origin !== new URL(process.env.NEXT_PUBLIC_SUPABASE_URL!).origin) {
    redirect(failure);
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
  const { error } = await supabase.auth.resetPasswordForEmail(parsed.data.email, {
    redirectTo: `${getAppUrl()}/auth/confirm?next=/login/reset-password`,
  });
  if (error && (error.status === 429 || error.status === 0 || error.status === undefined || error.status >= 500)) {
    return { error: "Recovery is temporarily unavailable. Please try again later." };
  }
  // Avoid disclosing whether an email address belongs to an account.
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
  redirect("/login?auth=password-updated");
}

export async function signOutAction() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    await supabase.auth.signOut();
  }
  redirect("/login");
}

export async function createShopAction(
  _previous: FormActionState,
  formData: FormData,
): Promise<FormActionState> {
  const parsed = createShopSchema.safeParse({ name: readText(formData, "name") });
  if (!parsed.success) return { error: "Shop name must be between 2 and 120 characters." };
  if (!isSupabaseConfigured()) return { error: "Supabase setup is incomplete. Follow the setup steps in docs/MILESTONE_2A_1.md." };

  const supabase = await createClient();
  const { data, error } = await supabase.rpc("create_shop_for_current_user", {
    p_name: parsed.data.name,
  });
  const shopId = uuidSchema.safeParse(data);
  if (error || !shopId.success) {
    return { error: "Shop setup is unavailable. Apply the documented database migration, then try again." };
  }
  redirect(shopDestination(readText(formData, "next"), shopId.data));
}
