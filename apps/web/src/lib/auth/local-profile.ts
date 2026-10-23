import crypto from "node:crypto";
import { getDb } from "../db/sqlite.ts";

export type LocalAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: {
    display_name?: unknown;
    full_name?: unknown;
    name?: unknown;
    given_name?: unknown;
  } | null;
};

/**
 * Extract the best human-readable name from user metadata.
 * Google OAuth provides `full_name`, `name`, and `given_name`.
 * Form sign-up provides `display_name`.
 */
export function extractDisplayName(user: LocalAuthUser): string {
  const meta = user.user_metadata;
  if (typeof meta?.full_name === "string" && meta.full_name.trim()) {
    return meta.full_name.trim();
  }
  if (typeof meta?.name === "string" && meta.name.trim()) {
    return meta.name.trim();
  }
  if (typeof meta?.display_name === "string" && meta.display_name.trim()) {
    return meta.display_name.trim();
  }
  if (typeof meta?.given_name === "string" && meta.given_name.trim()) {
    return meta.given_name.trim();
  }
  if (user.email && user.email.includes("@")) {
    const localPart = user.email.split("@")[0]?.trim();
    if (localPart) {
      return localPart.charAt(0).toUpperCase() + localPart.slice(1);
    }
  }
  return "Merchant";
}

/**
 * Deterministically produce an RFC4122 v4-compliant UUID from a user ID.
 * This guarantees that across serverless cold starts and different lambda instances,
 * the user's primary store always has the exact same UUID.
 */
export function deterministicShopId(userId: string): string {
  const hash = crypto.createHash("sha256").update(`salesayar:shop:${userId}`).digest("hex");
  return `${hash.slice(0, 8)}-${hash.slice(8, 12)}-4${hash.slice(13, 16)}-a${hash.slice(17, 20)}-${hash.slice(20, 32)}`;
}

/**
 * Ensure a Supabase-authenticated user can resolve a SaleSayar workspace session.
 * Guarantees profile, primary live store, and sample boutique access exist on every container.
 */
export function ensureLocalProfile(user: LocalAuthUser): { shopId: string; displayName: string } {
  const db = getDb();
  const now = new Date().toISOString();
  const displayName = extractDisplayName(user);

  db.prepare(`
    INSERT OR IGNORE INTO profiles (id, email, display_name, role, password_hash, status, created_at, updated_at)
    VALUES (?, ?, ?, 'owner', NULL, 'active', ?, ?)
  `).run(user.id, user.email ?? "", displayName, now, now);

  db.prepare(`
    UPDATE profiles
    SET email = CASE WHEN email IS NULL OR email = '' THEN ? ELSE email END,
        display_name = CASE WHEN display_name IS NULL OR display_name = '' OR display_name = 'Merchant' THEN ? ELSE display_name END,
        updated_at = ?
    WHERE id = ?
  `).run(user.email ?? "", displayName, now, user.id);

  // Auto-redeem any pending shop invitations for this email
  if (user.email && user.email.includes("@")) {
    try {
      const pendingInvites = db.prepare(`
        SELECT id, shop_id, role
        FROM shop_invitations
        WHERE lower(email) = lower(?)
      `).all(user.email.trim()) as Array<{ id: string; shop_id: string; role: string }>;

      for (const invite of pendingInvites) {
        db.prepare(`
          INSERT OR REPLACE INTO shop_memberships (shop_id, user_id, role, created_at)
          VALUES (?, ?, ?, ?)
        `).run(invite.shop_id, user.id, invite.role || "staff", now);

        db.prepare(`
          DELETE FROM shop_invitations WHERE id = ?
        `).run(invite.id);
      }
    } catch (err) {
      console.warn("Failed auto-redeeming pending shop invitations:", err);
    }
  }

  // Check if user already has an active live shop membership
  const existingMembership = db.prepare(`
    SELECT sm.shop_id
    FROM shop_memberships sm
    JOIN shops s ON sm.shop_id = s.id
    WHERE sm.user_id = ? AND s.is_sample = 0
    ORDER BY (SELECT COUNT(*) FROM orders o WHERE o.shop_id = s.id) DESC, sm.created_at ASC
    LIMIT 1
  `).get(user.id) as { shop_id: string } | undefined;

  let targetShopId = existingMembership?.shop_id;

  if (!targetShopId) {
    targetShopId = deterministicShopId(user.id);
    const shopName = `${displayName}’s Shop`;

    db.prepare(`
      INSERT OR IGNORE INTO shops (id, name, currency, is_sample, created_at, updated_at)
      VALUES (?, ?, 'MMK', 0, ?, ?)
    `).run(targetShopId, shopName, now, now);

    db.prepare(`
      INSERT OR IGNORE INTO shop_memberships (shop_id, user_id, role, created_at)
      VALUES (?, ?, 'owner', ?)
    `).run(targetShopId, user.id, now);
  }

  // Update generic shop names to user's real store name if applicable
  if (displayName !== "Merchant") {
    try {
      db.prepare(`
        UPDATE shops
        SET name = ?
        WHERE id = ? AND (name = 'Merchant’s Shop' OR name = 'Merchant Store')
      `).run(`${displayName}’s Shop`, targetShopId);
    } catch {
      // Non-critical
    }
  }

  return { shopId: targetShopId, displayName };
}
