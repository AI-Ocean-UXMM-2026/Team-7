import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authDestination, getAppUrl } from "@/lib/auth";
import { createSessionCookie } from "@/lib/auth/session";
import { ensureLocalProfile, type LocalAuthUser } from "@/lib/auth/local-profile";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const origin = getAppUrl();
  const next = authDestination(request.nextUrl.searchParams.get("next"));
  const failure = () => NextResponse.redirect(new URL(`/login?${new URLSearchParams({ auth: "failed", next })}`, origin));
  if (!isSupabaseConfigured() || request.nextUrl.searchParams.has("error")) {
    return failure();
  }

  const supabase = await createClient();
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && (type === "email" || type === "signup" || type === "recovery")
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : null;
  if (!result || result.error) return failure();

  const user = (result.data.user ?? result.data.session?.user) as LocalAuthUser | null | undefined;
  if (!user?.id) return failure();

  if (type !== "recovery") {
    ensureLocalProfile(user);
    await createSessionCookie(user.id);
  }

  const destination = type === "recovery"
    ? "/login/reset-password"
    : next;
  return NextResponse.redirect(new URL(destination, origin));
}
