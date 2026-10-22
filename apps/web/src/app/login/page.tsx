import { redirect } from "next/navigation";
import { AuthForm } from "./auth-form";
import { authDestination } from "@/lib/auth";
import { getCurrentSession } from "@/lib/auth/session";

export default async function LoginPage({ searchParams }: {
  searchParams: Promise<{ auth?: string; confirmation?: string; next?: string; reason?: string }>;
}) {
  const params = await searchParams;
  const next = authDestination(params.next ?? null);
  const allowSwitch = (params as Record<string, string | undefined>)?.switch === "1" || (params as Record<string, string | undefined>)?.preview === "1";
  if (!allowSwitch && (await getCurrentSession())) redirect(next);
  const notice = params.auth === "password-updated"
    ? "Password updated. Sign in with your new password."
    : params.auth === "configuration"
      ? "Supabase setup is incomplete. Check the app environment settings."
      : params.reason
        ? `Sign-in could not be completed: ${params.reason}. If using Google, ensure Google provider is enabled in your Supabase dashboard.`
        : params.auth === "failed" || params.confirmation === "failed"
          ? "Sign-in or email confirmation could not be completed. Try again; email links may have expired."
          : undefined;
  return <AuthForm mode="sign-in" notice={notice ?? (next.startsWith("/sales") ? "Sign in to manage your shop’s private orders. Public sample pages remain available." : undefined)} next={next} />;
}
