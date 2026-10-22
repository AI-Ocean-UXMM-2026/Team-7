import crypto from "node:crypto";
import { getDb, SAMPLE_SHOP_ID } from "../db/sqlite.ts";

export type LocalAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: { display_name?: unknown } | null;
};

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
export function ensureLocalProfile(user: LocalAuthUser): { shopId: string } {
  const db = getDb();
  const now = new Date().toISOString();
  const displayName =
    typeof user.user_metadata?.display_name === "string" && user.user_metadata.display_name.trim()
      ? user.user_metadata.display_name.trim()
      : user.email?.split("@")[0] || "Merchant";

  db.prepare(`
    INSERT OR IGNORE INTO profiles (id, email, display_name, role, password_hash, status, created_at, updated_at)
    VALUES (?, ?, ?, 'owner', NULL, 'active', ?, ?)
  `).run(user.id, user.email ?? "", displayName, now, now);

  db.prepare(`
    UPDATE profiles
    SET email = CASE WHEN email IS NULL OR email = '' THEN ? ELSE email END,
        display_name = CASE WHEN display_name IS NULL OR display_name = '' THEN ? ELSE display_name END,
        updated_at = ?
    WHERE id = ?
  `).run(user.email ?? "", displayName, now, user.id);

  // Check if user already has an active live shop membership
  const existingMembership = db.prepare(`
    SELECT sm.shop_id
    FROM shop_memberships sm
    JOIN shops s ON sm.shop_id = s.id
    WHERE sm.user_id = ? AND s.is_sample = 0
    ORDER BY sm.created_at ASC
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

  // Also ensure owner membership to the sample demo boutique
  db.prepare(`
    INSERT OR IGNORE INTO shop_memberships (shop_id, user_id, role, created_at)
    VALUES (?, ?, 'owner', ?)
  `).run(SAMPLE_SHOP_ID, user.id, now);

  return { shopId: targetShopId };
}
