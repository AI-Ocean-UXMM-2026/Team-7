import Link from "next/link";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { RecoveryForm } from "../recovery-form";

export default async function ResetPasswordPage() {
  const supabase = isSupabaseConfigured() ? await createClient() : null;
  const result = await supabase?.auth.getUser();
  if (!result?.data.user) {
    return <main className="auth-page"><section className="auth-card">
      <h1>Request a password reset</h1>
      <p className="auth-description">Your recovery session is missing or expired.</p>
      <Link href="/login/forgot-password" className="auth-back">Request a new link</Link>
    </section></main>;
  }
  return <RecoveryForm reset />;
}
