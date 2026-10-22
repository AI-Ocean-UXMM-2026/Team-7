import crypto from "node:crypto";
import { getDb } from "../db/sqlite.ts";

const hex64 = /^[a-f0-9]{64}$/u;
const expiresInMs = 2 * 60 * 1000;

export function acceptAssistantChallenge(challenge: string, userId: string, now = Date.now()) {
  if (!hex64.test(challenge)) return false;
  const db = getDb();
  db.prepare("DELETE FROM assistant_pairings WHERE expires_at < ?").run(now);
  const result = db.prepare("INSERT OR IGNORE INTO assistant_pairings (challenge,user_id,expires_at,consumed_at) VALUES (?,?,?,NULL)").run(challenge, userId, now + expiresInMs);
  if (result.changes === 1) return true;
  const existing = db.prepare("SELECT user_id, expires_at, consumed_at FROM assistant_pairings WHERE challenge = ?").get(challenge) as { user_id: string; expires_at: number; consumed_at: number | null } | undefined;
  return existing?.user_id === userId && existing.expires_at >= now && existing.consumed_at === null;
}

export function redeemAssistantVerifier(verifier: string, now = Date.now()) {
  if (!hex64.test(verifier)) return null;
  const challenge = crypto.createHash("sha256").update(Buffer.from(verifier, "hex")).digest("hex");
  const db = getDb();
  db.exec("BEGIN IMMEDIATE");
  try {
    const row = db.prepare(`SELECT p.user_id FROM assistant_pairings p JOIN profiles u ON u.id = p.user_id
      WHERE p.challenge = ? AND p.consumed_at IS NULL AND p.expires_at >= ? AND coalesce(u.status,'active') = 'active'`).get(challenge, now) as { user_id: string } | undefined;
    if (!row) { db.exec("COMMIT"); return null; }
    const result = db.prepare("UPDATE assistant_pairings SET consumed_at = ? WHERE challenge = ? AND consumed_at IS NULL").run(now, challenge);
    db.exec("COMMIT");
    return result.changes === 1 ? row.user_id : null;
  } catch (error) { db.exec("ROLLBACK"); throw error; }
}
