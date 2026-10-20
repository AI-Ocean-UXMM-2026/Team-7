import { redirect } from "next/navigation";
import { AuthForm } from "./auth-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authDestination } from "@/lib/auth";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ auth?: string; confirmation?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = authDestination(params.next ?? null);
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) redirect(next);
  }
  const notice = params.auth === "password-updated"
    ? "Password updated. Sign in with your new password."
    : params.auth === "configuration"
      ? "Supabase setup is incomplete. Check the app environment settings."
      : params.auth === "failed" || params.confirmation === "failed"
        ? "Sign-in or email confirmation could not be completed. Try again; email links may have expired."
        : undefined;
  return <AuthForm mode="sign-in" notice={notice ?? (next.startsWith("/sales") ? "Sign in to manage your shop’s private orders. Public sample pages remain available." : undefined)} next={next} />;
}
