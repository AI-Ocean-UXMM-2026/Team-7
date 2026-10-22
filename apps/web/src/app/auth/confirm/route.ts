import { NextResponse, type NextRequest } from "next/server";
import { cookies } from "next/headers.js";
import { createClient } from "@/lib/supabase/server";
import { isSupabaseConfigured } from "@/lib/supabase/config";
import { authDestination, getAppUrl, shopDestination } from "@/lib/auth";
import { createSessionCookie, SESSION_COOKIE } from "@/lib/auth/session";
import { ensureLocalProfile, type LocalAuthUser } from "@/lib/auth/local-profile";

export async function GET(request: NextRequest) {
  const code = request.nextUrl.searchParams.get("code");
  const tokenHash = request.nextUrl.searchParams.get("token_hash");
  const type = request.nextUrl.searchParams.get("type");
  const errorParam = request.nextUrl.searchParams.get("error");
  const errorDesc = request.nextUrl.searchParams.get("error_description");
  const hostHeader = request.headers.get("x-forwarded-host") || request.headers.get("host");
  const protoHeader =
    request.headers.get("x-forwarded-proto") ||
    (hostHeader?.includes("localhost") || hostHeader?.includes("127.0.0.1") ? "http" : "https");
  const hostOrigin = hostHeader
    ? `${protoHeader}://${hostHeader}`
    : request.nextUrl.origin && !request.nextUrl.origin.includes("invalid")
      ? request.nextUrl.origin
      : undefined;
  const origin = getAppUrl(hostOrigin);
  const next = authDestination(request.nextUrl.searchParams.get("next"));
  const failure = (reason?: string) =>
    NextResponse.redirect(
      new URL(
        `/login?${new URLSearchParams({ auth: "failed", ...(reason ? { reason } : {}), next })}`,
        origin,
      ),
    );
  if (!isSupabaseConfigured()) {
    return failure("configuration");
  }
  if (errorParam || errorDesc) {
    console.error("Auth callback error parameter:", errorParam, errorDesc);
    return failure(errorDesc || errorParam || "callback-error");
  }

  const supabase = await createClient();
  const result = code
    ? await supabase.auth.exchangeCodeForSession(code)
    : tokenHash && (type === "email" || type === "signup" || type === "recovery")
      ? await supabase.auth.verifyOtp({ token_hash: tokenHash, type })
      : null;
  if (!result || result.error) {
    console.error("Auth verification error:", result?.error);
    return failure(result?.error?.message || "verification-failed");
  }

  const user = (result.data.user ?? result.data.session?.user) as LocalAuthUser | null | undefined;
  if (!user?.id) return failure("no-user-id");

  if (type !== "recovery") {
    const { shopId, displayName } = ensureLocalProfile(user);
    const sessionToken = await createSessionCookie(user.id, undefined, {
      email: user.email ?? undefined,
      displayName,
    });
    const targetPath = (next === "/workspace" || next === "/")
      ? `/?shop=${shopId}&source=live`
      : shopDestination(next, shopId);
    const response = NextResponse.redirect(new URL(targetPath, origin));

    // Propagate all cookies (including Supabase auth tokens) from the server cookie store
    try {
      const cookieStore = await cookies();
      for (const cookie of cookieStore.getAll()) {
        response.cookies.set(cookie.name, cookie.value);
      }
    } catch {
      // Non-critical cookie synchronization
    }

    // Set signed session cookie with explicit secure flag matching connection protocol
    response.cookies.set(SESSION_COOKIE, sessionToken, {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: origin.startsWith("https"),
      maxAge: 60 * 60 * 24 * 7,
    });
    return response;
  }

  return NextResponse.redirect(new URL("/login/reset-password", origin));
}
