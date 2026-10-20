import { redirect } from "next/navigation";
import { AuthForm } from "@/app/login/auth-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { assistantDestination } from "@/lib/auth";

export const dynamic = "force-dynamic";

export default async function AssistantLoginPage({ searchParams }: {
  searchParams: Promise<{ auth?: string; next?: string }>;
}) {
  const params = await searchParams;
  const next = assistantDestination(params.next ?? null);
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) redirect(next);
  }
  const notice = params.auth === "configuration"
    ? "Supabase setup is incomplete. Check the hosted assistant environment settings."
    : params.auth === "failed"
      ? "Sign-in could not be completed. Check your email and password, then try again."
      : undefined;
  return <AuthForm mode="sign-in" showGoogle={false} showRecovery={false} showSignUp={false} showBack={false} next={next} notice={notice ?? "Use email and password to continue in this hosted assistant session."} />;
}
