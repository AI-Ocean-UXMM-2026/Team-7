import crypto from "node:crypto";
import { cookies } from "next/headers.js";
import { uuidSchema } from "@ocean/contracts";
import { getDb } from "../db/sqlite.ts";
import { ensureLocalProfile } from "./local-profile.ts";
import {
  SESSION_COOKIE,
  type SessionUser,
  type AuthorizedShopSession,
  type SessionTokenPayload,
  signSessionToken,
  verifySessionToken,
  verifyShopMembership,
  getUserAuthorizedShops,
} from "./token.ts";

export {
  SESSION_COOKIE,
  type SessionUser,
  type AuthorizedShopSession,
  type SessionTokenPayload,
  signSessionToken,
  verifySessionToken,
  verifyShopMembership,
  getUserAuthorizedShops,
};

/**
 * Resolve session user from a token string.
 * FAILS CLOSED:
 * - Returns null if token is missing, unsigned, forged, malformed, or expired.
 * - Returns null if user profile does not exist in the database.
 * - Returns null if account is disabled or revoked.
 * - Returns null if the session was issued at or before profile.session_revoked_at.
 */
export function resolveSessionUser(token?: string | null): SessionUser | null {
  if (!token) return null;
  const verified = verifySessionToken(token);
  if (!verified) return null;

  const db = getDb();
  try {
    let profile = db.prepare("SELECT id, email, display_name, status, session_revoked_at FROM profiles WHERE id = ?").get(verified.sub) as
      | { id: string; email: string; display_name: string; status: string | null; session_revoked_at: string | null }
      | undefined;

    // Self-heal on serverless cold starts: recreate profile & primary store only from verified token that contains authenticated user credentials
    if (!profile && verified.email && verified.email.trim()) {
      ensureLocalProfile({
        id: verified.sub,
        email: verified.email,
        user_metadata: verified.name ? { display_name: verified.name } : null,
      });
      profile = db.prepare("SELECT id, email, display_name, status, session_revoked_at FROM profiles WHERE id = ?").get(verified.sub) as
        | { id: string; email: string; display_name: string; status: string | null; session_revoked_at: string | null }
        | undefined;
    }

    // Fail closed if profile does not exist
    if (!profile) return null;

    // Fail closed if account is disabled or revoked
    if (profile.status === "disabled" || profile.status === "revoked") {
      return null;
    }

    // Explicitly invalidate session if it was issued at or before session_revoked_at
    if (profile.session_revoked_at) {
      const revokedAtMs = new Date(profile.session_revoked_at).getTime();
      if (verified.iat <= revokedAtMs) {
        return null;
      }
    }

    return {
      userId: profile.id,
      email: profile.email || "",
      displayName: profile.display_name || "Merchant",
    };
  } catch {
    return null;
  }
}

/**
 * Read and verify session from request cookies.
 * FAILS CLOSED: Returns null if cookie is missing, unsigned, forged, malformed, expired, or revoked.
 */
export async function getCurrentSession(): Promise<SessionUser | null> {
  try {
    const cookieStore = await cookies();
    const token = cookieStore.get(SESSION_COOKIE)?.value;
    return resolveSessionUser(token);
  } catch {
    return null;
  }
}

/**
 * Explicitly revoke all existing sessions for a user ID.
 */
export function revokeUserSessions(userId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE profiles SET session_revoked_at = ?, updated_at = ? WHERE id = ?").run(now, now, userId);
}

/**
 * Explicitly disable an account, remove its credentials, and revoke all sessions.
 */
export function disableUserAccount(userId: string): void {
  const db = getDb();
  const now = new Date().toISOString();
  db.prepare("UPDATE profiles SET status = 'disabled', password_hash = NULL, session_revoked_at = ?, updated_at = ? WHERE id = ?").run(now, now, userId);
}

/**
 * Resolve an authenticated shop session for a specific shop.
 * FAILS CLOSED: Returns null if unauthenticated or caller is not an authorized member of targetShopId.
 */
export async function getAuthorizedShopSession(requestedShopId?: string): Promise<AuthorizedShopSession | null> {
  const session = await getCurrentSession();
  if (!session) return null;

  let targetShopId = requestedShopId;

  if (!targetShopId || !uuidSchema.safeParse(targetShopId).success) {
    try {
      const cookieStore = await cookies();
      const activeCookie = cookieStore.get("salesayar_active_shop")?.value;
      if (activeCookie && uuidSchema.safeParse(activeCookie).success) {
        const mem = verifyShopMembership(session.userId, activeCookie);
        if (mem.authorized && mem.shop) {
          targetShopId = activeCookie;
        }
      }
    } catch {
      // In contexts without cookie store, continue to fallback
    }
  }

  if (!targetShopId || !uuidSchema.safeParse(targetShopId).success) {
    const shops = getUserAuthorizedShops(session.userId);
    if (shops.length === 0) return null;
    targetShopId = shops[0]!.shop_id;
  }

  const membership = verifyShopMembership(session.userId, targetShopId);
  if (!membership.authorized || !membership.shop) return null;

  return {
    user: {
      userId: session.userId,
      email: session.email || "",
      displayName: session.displayName || "Merchant",
    },
    shop: membership.shop,
    role: membership.role || "staff",
  };
}

/**
 * Issue a signed session cookie. Safely returns signed token in test/non-request environments.
 */
export async function createSessionCookie(
  userId: string,
  maxAgeSeconds: number = 60 * 60 * 24 * 7,
  extra?: { email?: string; displayName?: string }
): Promise<string> {
  let cookieStore;
  try {
    cookieStore = await cookies();
  } catch {
    // Non-request or testing environment
  }
  const now = Date.now();
  const payload: SessionTokenPayload = {
    sub: userId,
    iat: now,
    exp: now + maxAgeSeconds * 1000,
    nonce: crypto.randomBytes(8).toString("hex"),
    email: extra?.email,
    name: extra?.displayName,
  };

  const token = signSessionToken(payload);

  if (cookieStore) {
    try {
      cookieStore.set(SESSION_COOKIE, token, {
        path: "/",
        httpOnly: true,
        sameSite: "lax",
        secure: process.env.NODE_ENV === "production",
        maxAge: maxAgeSeconds,
      });
    } catch {
      // Cookie setting failed or not supported in current context
    }
  }

  return token;
}

/**
 * Clear the session cookie.
 */
export async function clearSessionCookie(): Promise<void> {
  try {
    const cookieStore = await cookies();
    cookieStore.set(SESSION_COOKIE, "", {
      path: "/",
      httpOnly: true,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      maxAge: 0,
    });
  } catch {
    // Non-request context
  }
}
