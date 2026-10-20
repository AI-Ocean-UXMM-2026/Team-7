import { redirect } from "next/navigation";
import { AuthForm } from "./auth-form";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";

export default async function LoginPage() {
  if (isSupabaseConfigured()) {
    const supabase = await createClient();
    const { data } = await supabase.auth.getClaims();
    if (data?.claims?.sub) redirect("/workspace");
  }
  return <AuthForm mode="sign-in" />;
}
