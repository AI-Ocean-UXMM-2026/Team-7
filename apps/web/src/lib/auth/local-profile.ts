import { getDb } from "../db/sqlite.ts";

export type LocalAuthUser = {
  id: string;
  email?: string | null;
  user_metadata?: { display_name?: unknown } | null;
};

/** Ensure a Supabase-authenticated user can resolve a SaleSayar workspace session. */
export function ensureLocalProfile(user: LocalAuthUser): void {
  const db = getDb();
  const now = new Date().toISOString();
  const displayName = typeof user.user_metadata?.display_name === "string"
    ? user.user_metadata.display_name.trim()
    : "";

  db.prepare(`
    INSERT OR IGNORE INTO profiles (id, email, display_name, role, password_hash, status, created_at, updated_at)
    VALUES (?, ?, ?, 'owner', NULL, 'active', ?, ?)
  `).run(user.id, user.email ?? "", displayName || "Merchant", now, now);

  db.prepare(`
    UPDATE profiles
    SET email = CASE WHEN email IS NULL OR email = '' THEN ? ELSE email END,
        display_name = CASE WHEN display_name IS NULL OR display_name = '' THEN ? ELSE display_name END,
        updated_at = ?
    WHERE id = ?
  `).run(user.email ?? "", displayName || "Merchant", now, user.id);
}
