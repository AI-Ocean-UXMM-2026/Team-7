import crypto from "node:crypto";
import { uuidSchema } from "@ocean/contracts";
import { getDb } from "../db/sqlite.ts";
import { ensureLocalProfile } from "./local-profile.ts";

export const SESSION_COOKIE = "salesayar_session";

export interface SessionUser {
  userId: string;
  email?: string;
  displayName?: string;
}

export interface AuthorizedShopSession {
  user: {
    userId: string;
    displayName: string;
    email: string;
  };
  shop: {
    id: string;
    name: string;
    currency: string;
    is_sample: boolean;
  };
  role: "owner" | "admin" | "staff";
}

export interface SessionTokenPayload {
  sub: string; // userId (UUID)
  iat: number; // issuedAt ms
  exp: number; // expiresAt ms
  nonce: string;
  email?: string;
  name?: string;
}

export function getSessionSecret(): string {
  const secret = process.env.SESSION_SECRET?.trim();
  if (!secret || secret.length < 32) {
    throw new Error("SESSION_SECRET is missing or insecure. A dedicated secret of at least 32 characters is required.");
  }
  return secret;
}

/**
 * Sign session payload into `<base64url(payload)>.<base64url(hmac)>`
 */
export function signSessionToken(payload: SessionTokenPayload, secret?: string): string {
  const activeSecret = secret ?? getSessionSecret();
  const payloadStr = JSON.stringify(payload);
  const data = Buffer.from(payloadStr, "utf-8").toString("base64url");
  const signature = crypto.createHmac("sha256", activeSecret).update(data).digest("base64url");
  return `${data}.${signature}`;
}

/**
 * Verify session token. Fails closed on any signature mismatch, malformed payload, or expiration.
 */
export function verifySessionToken(token: string | undefined | null, secret?: string): SessionTokenPayload | null {
  if (!token || typeof token !== "string") return null;

  let activeSecret: string;
  try {
    activeSecret = secret ?? getSessionSecret();
  } catch {
    // Fail closed if dedicated secret is missing or insecure
    return null;
  }

  const parts = token.split(".");
  if (parts.length !== 2) return null;

  const [data, signature] = parts;
  if (!data || !signature) return null;

  // Compute expected HMAC
  const expectedSig = crypto.createHmac("sha256", activeSecret).update(data).digest("base64url");

  // Constant-time comparison to prevent timing attacks
  if (signature.length !== expectedSig.length) return null;
  const sigBuf = Buffer.from(signature);
  const expBuf = Buffer.from(expectedSig);
  if (!crypto.timingSafeEqual(sigBuf, expBuf)) return null;

  try {
    const json = Buffer.from(data, "base64url").toString("utf-8");
    const payload = JSON.parse(json) as SessionTokenPayload;

    if (!payload || typeof payload !== "object") return null;
    if (typeof payload.sub !== "string" || !uuidSchema.safeParse(payload.sub).success) return null;
    if (typeof payload.exp !== "number" || Date.now() > payload.exp) return null;

    return payload;
  } catch {
    return null;
  }
}

/**
 * Verify shop membership server-side. Role and shop access are NEVER trusted from client cookies.
 */
export function verifyShopMembership(
  userId: string,
  shopId: string
): {
  authorized: boolean;
  role?: "owner" | "admin" | "staff";
  shop?: { id: string; name: string; currency: string; is_sample: boolean };
} {
  if (!uuidSchema.safeParse(userId).success || !uuidSchema.safeParse(shopId).success) {
    return { authorized: false };
  }

  const db = getDb();
  try {
    const userRow = db.prepare("SELECT status FROM profiles WHERE id = ?").get(userId) as { status?: string | null } | undefined;
    if (userRow && (userRow.status === "disabled" || userRow.status === "revoked")) {
      return { authorized: false };
    }

    let row = db.prepare(`
      SELECT sm.role, s.id as shop_id, s.name as shop_name, s.currency, s.is_sample
      FROM shop_memberships sm
      JOIN shops s ON sm.shop_id = s.id
      WHERE sm.user_id = ? AND sm.shop_id = ?
    `).get(userId, shopId) as { role: string; shop_id: string; shop_name: string; currency: string; is_sample: number } | undefined;

    // Self-heal on serverless cold starts or fresh container instances
    if (!row) {
      ensureLocalProfile({ id: userId });
      row = db.prepare(`
        SELECT sm.role, s.id as shop_id, s.name as shop_name, s.currency, s.is_sample
        FROM shop_memberships sm
        JOIN shops s ON sm.shop_id = s.id
        WHERE sm.user_id = ? AND sm.shop_id = ?
      `).get(userId, shopId) as { role: string; shop_id: string; shop_name: string; currency: string; is_sample: number } | undefined;
    }

    if (!row) {
      return { authorized: false };
    }

    return {
      authorized: true,
      role: (row.role as "owner" | "admin" | "staff") || "staff",
      shop: {
        id: row.shop_id,
        name: row.shop_name,
        currency: row.currency,
        is_sample: Boolean(row.is_sample),
      },
    };
  } catch {
    return { authorized: false };
  }
}

/**
 * Retrieve user's authorized shops from database.
 */
export function getUserAuthorizedShops(userId: string): Array<{
  shop_id: string;
  shop_name: string;
  role: "owner" | "admin" | "staff";
  currency: string;
  is_sample: boolean;
}> {
  if (!uuidSchema.safeParse(userId).success) return [];
  const db = getDb();
  try {
    let rows = db.prepare(`
      SELECT sm.shop_id, s.name as shop_name, sm.role, s.currency, s.is_sample
      FROM shop_memberships sm
      JOIN shops s ON sm.shop_id = s.id
      WHERE sm.user_id = ?
      ORDER BY s.is_sample ASC, sm.created_at DESC
    `).all(userId) as Array<{ shop_id: string; shop_name: string; role: string; currency: string; is_sample: number }>;

    // Self-heal on serverless cold starts: if no shops found, provision primary store
    if (rows.length === 0) {
      ensureLocalProfile({ id: userId });
      rows = db.prepare(`
        SELECT sm.shop_id, s.name as shop_name, sm.role, s.currency, s.is_sample
        FROM shop_memberships sm
        JOIN shops s ON sm.shop_id = s.id
        WHERE sm.user_id = ?
        ORDER BY s.is_sample ASC, sm.created_at DESC
      `).all(userId) as Array<{ shop_id: string; shop_name: string; role: string; currency: string; is_sample: number }>;
    }

    return rows.map((r) => ({
      shop_id: r.shop_id,
      shop_name: r.shop_name,
      role: (r.role as "owner" | "admin" | "staff") || "staff",
      currency: r.currency,
      is_sample: Boolean(r.is_sample),
    }));
  } catch {
    return [];
  }
}
