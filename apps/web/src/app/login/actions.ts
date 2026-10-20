"use server";

import { createShopSchema, signInSchema, signUpSchema, uuidSchema } from "@ocean/contracts";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

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
  redirect("/workspace");
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
  const appUrl = (process.env.NEXT_PUBLIC_APP_URL ?? "http://127.0.0.1:3000").replace(/\/$/, "");
  const { data, error } = await supabase.auth.signUp({
    email: parsed.data.email,
    password: parsed.data.password,
    options: {
      data: { display_name: parsed.data.display_name },
      emailRedirectTo: `${appUrl}/auth/confirm`,
    },
  });
  if (error) return { error: "Account creation failed. Check the details or try signing in." };
  if (data.session) redirect("/workspace/setup");
  return { success: "Account created. Check your email to confirm, then sign in." };
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
  redirect(`/workspace/${shopId.data}`);
}
