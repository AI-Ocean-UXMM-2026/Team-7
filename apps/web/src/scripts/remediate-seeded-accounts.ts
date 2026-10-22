/**
 * Administrative Migration Utility: Remediate Seeded Credentials
 *
 * Genuinely Read-Only Dry-Run:
 * - Does NOT call getDb().
 * - Does NOT initialize schema or seed records.
 * - Does NOT create a missing database file or directories.
 * - Opens existing SQLite database in readOnly mode when auditing.
 *
 * Identity Evidence & Legacy Account Detection:
 * - Uses known seeded UUIDs (DEFAULT_USER_ID, STAFF_USER_ID).
 * - Tests password hashes against known predictable passwords (Admin@1234, Staff@1234).
 * - An email match alone does NOT prove a password is predictable; accounts with custom passwords are noted and preserved.
 *
 * Explicit Session Invalidation:
 * - On execute, sets session_revoked_at = datetime('now') and status = 'disabled'.
 * - Revokes live shop memberships without deleting profiles or business records.
 */

import fs from "node:fs";
import { DatabaseSync } from "node:sqlite";
import { resolveDbPath, DEFAULT_USER_ID, STAFF_USER_ID } from "../lib/db/sqlite.ts";
import { verifyPassword } from "../lib/auth/password.ts";

export interface SeededAccountEvidence {
  id: string;
  email: string;
  displayName: string;
  role: string;
  isKnownSeededId: boolean;
  hasPasswordHash: boolean;
  isPredictablePasswordConfirmed: boolean;
  predictablePasswordMatch?: "Admin@1234" | "Staff@1234";
  hasCustomPassword: boolean;
  isAlreadyDisabled: boolean;
  liveShopCount: number;
  sampleShopCount: number;
}

export function auditAndRemediateSeededAccounts(options: {
  execute?: boolean;
  dbPath?: string;
  silent?: boolean;
} = {}) {
  const { execute = false, silent = false } = options;
  const targetDbPath = options.dbPath || process.env.SALESAYAR_DB_PATH || resolveDbPath();

  const log = (...args: unknown[]) => {
    if (!silent) console.log(...args);
  };

  log("=== Seeded Accounts Audit & Remediation Tool ===");
  log(`Database Path: ${targetDbPath}`);
  log(`Mode: ${execute ? "EXECUTE (Applying bounded remediation)" : "DRY RUN (Genuinely read-only audit)"}\n`);

  // 1. Check if database file exists. DO NOT create missing file or directory in dry-run!
  if (targetDbPath !== ":memory:" && !fs.existsSync(targetDbPath)) {
    log(`Notice: Database file does not exist at "${targetDbPath}".`);
    log("Dry-run completed: zero changes made, zero databases created.\n");
    return { audited: 0, predictableCount: 0, remediatedCount: 0, dbExisted: false, evidence: [] as SeededAccountEvidence[] };
  }

  // 2. Open database with readOnly: true for dry-run
  const db = targetDbPath === ":memory:"
    ? new DatabaseSync(":memory:")
    : new DatabaseSync(targetDbPath, { readOnly: !execute });

  try {
    // Check if profiles table exists (without modifying schema)
    const tableCheck = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='profiles'").get();
    if (!tableCheck) {
      log("Notice: Table 'profiles' does not exist in this database.");
      return { audited: 0, predictableCount: 0, remediatedCount: 0, dbExisted: true, evidence: [] as SeededAccountEvidence[] };
    }

    // Check what columns exist in profiles
    const tableCols = (db.prepare("PRAGMA table_info(profiles)").all() as Array<{ name: string }>).map((c) => c.name);
    const hasPasswordCol = tableCols.includes("password_hash");
    const hasStatusCol = tableCols.includes("status");
    const hasRevokedCol = tableCols.includes("session_revoked_at");
    const hasUpdatedCol = tableCols.includes("updated_at");

    // Query potential seeded profiles by known IDs or emails
    const candidateQuery = `
      SELECT id, email, display_name, role
             ${hasPasswordCol ? ", password_hash" : ", NULL as password_hash"}
             ${hasStatusCol ? ", status" : ", 'active' as status"}
             ${hasRevokedCol ? ", session_revoked_at" : ", NULL as session_revoked_at"}
      FROM profiles
      WHERE id IN (?, ?) OR email IN ('owner@salesayar.com', 'staff@salesayar.com')
    `;

    const candidates = db.prepare(candidateQuery).all(DEFAULT_USER_ID, STAFF_USER_ID) as Array<{
      id: string;
      email: string;
      display_name: string;
      role: string;
      password_hash: string | null;
      status: string | null;
      session_revoked_at: string | null;
    }>;

    const auditedEvidence: SeededAccountEvidence[] = [];

    for (const c of candidates) {
      const isKnownSeededId = c.id === DEFAULT_USER_ID || c.id === STAFF_USER_ID;
      const hasPassword = Boolean(c.password_hash);
      const isAlreadyDisabled = c.status === "disabled" || !hasPassword;

      let isPredictablePasswordConfirmed = false;
      let predictablePasswordMatch: "Admin@1234" | "Staff@1234" | undefined;

      if (hasPassword && c.password_hash) {
        if (verifyPassword("Admin@1234", c.password_hash)) {
          isPredictablePasswordConfirmed = true;
          predictablePasswordMatch = "Admin@1234";
        } else if (verifyPassword("Staff@1234", c.password_hash)) {
          isPredictablePasswordConfirmed = true;
          predictablePasswordMatch = "Staff@1234";
        }
      }

      const hasCustomPassword = hasPassword && !isPredictablePasswordConfirmed;

      // Check shop memberships
      let liveShopCount = 0;
      let sampleShopCount = 0;
      try {
        const memberships = db.prepare(`
          SELECT s.is_sample
          FROM shop_memberships sm
          JOIN shops s ON sm.shop_id = s.id
          WHERE sm.user_id = ?
        `).all(c.id) as Array<{ is_sample: number }>;
        liveShopCount = memberships.filter((m) => m.is_sample === 0).length;
        sampleShopCount = memberships.filter((m) => m.is_sample === 1).length;
      } catch {}

      auditedEvidence.push({
        id: c.id,
        email: c.email,
        displayName: c.display_name,
        role: c.role,
        isKnownSeededId,
        hasPasswordHash: hasPassword,
        isPredictablePasswordConfirmed,
        predictablePasswordMatch,
        hasCustomPassword,
        isAlreadyDisabled,
        liveShopCount,
        sampleShopCount,
      });
    }

    log(`Found ${auditedEvidence.length} candidate account(s) matching known IDs or legacy emails:\n`);

    for (const a of auditedEvidence) {
      log(`• [${a.isKnownSeededId ? "KNOWN_SEEDED_ID" : "EXTERNAL_ID"}] ${a.email} (${a.displayName}, ID: ${a.id})`);
      if (a.isPredictablePasswordConfirmed) {
        log(`  ⚠️ PREDICTABLE SEEDED CREDENTIAL CONFIRMED: Password hash matches "${a.predictablePasswordMatch}"`);
      } else if (a.hasCustomPassword) {
        log(`  🔒 CUSTOM PASSWORD DETECTED: Password does NOT match known predictable passwords. Preserving merchant credential.`);
      } else {
        log(`  ✓ NO ACTIVE PASSWORD: Account is already passwordless or disabled.`);
      }
      log(`  Shop Access: ${a.liveShopCount} live shop(s), ${a.sampleShopCount} sample demo workspace(s)`);
    }

    const predictableAccounts = auditedEvidence.filter((a) => a.isPredictablePasswordConfirmed);

    if (!execute) {
      log(`\n[DRY RUN SUMMARY]`);
      log(`- Audited: ${auditedEvidence.length} account(s)`);
      log(`- Predictable seeded credentials found: ${predictableAccounts.length}`);
      log(`- Custom password accounts preserved: ${auditedEvidence.filter((a) => a.hasCustomPassword).length}`);
      log(`- Read-only audit finished. No data or schemas were created or modified.`);
      return { audited: auditedEvidence.length, predictableCount: predictableAccounts.length, remediatedCount: 0, dbExisted: true, evidence: auditedEvidence };
    }

    // EXECUTE MODE
    log("\n[APPLYING BOUNDED REMEDIATION]");
    if (predictableAccounts.length === 0) {
      log("✓ No confirmed predictable accounts found. Nothing to remediate.");
      return { audited: auditedEvidence.length, predictableCount: 0, remediatedCount: 0, dbExisted: true, evidence: auditedEvidence };
    }

    db.exec("BEGIN TRANSACTION;");
    try {
      const now = new Date().toISOString();

      // Ensure migration columns exist before updating
      if (!hasStatusCol) {
        db.exec("ALTER TABLE profiles ADD COLUMN status TEXT DEFAULT 'active';");
      }
      if (!hasRevokedCol) {
        db.exec("ALTER TABLE profiles ADD COLUMN session_revoked_at TEXT;");
      }

      for (const target of predictableAccounts) {
        // 1. Invalidate sessions and disable predictable password
        const updateSql = `
          UPDATE profiles
          SET password_hash = NULL,
              status = 'disabled',
              session_revoked_at = ?
              ${hasUpdatedCol ? ", updated_at = ?" : ""}
          WHERE id = ?
        `;
        const params = hasUpdatedCol ? [now, now, target.id] : [now, target.id];
        db.prepare(updateSql).run(...params);

        log(`✓ Disabled predictable password & revoked all active sessions for [${target.email}] (${target.id})`);

        // 2. Detach from live shops
        if (target.liveShopCount > 0) {
          const detached = db.prepare(`
            DELETE FROM shop_memberships
            WHERE user_id = ?
              AND shop_id IN (SELECT id FROM shops WHERE is_sample = 0)
          `).run(target.id);
          log(`✓ Detached from ${detached.changes} live shop(s) for user [${target.id}].`);
          log(`  Notice for administrators: If this live shop had merchant records, use onboarding to assign a verified owner.`);
        }
      }

      db.exec("COMMIT;");
      log("\n✓ Remediation successfully committed. All merchant business records and custom profiles preserved.");
      return { audited: auditedEvidence.length, predictableCount: predictableAccounts.length, remediatedCount: predictableAccounts.length, dbExisted: true, evidence: auditedEvidence };
    } catch (err) {
      db.exec("ROLLBACK;");
      log("Remediation error (transaction rolled back):", err);
      throw err;
    }
  } finally {
    db.close();
  }
}

// CLI entry point
if (process.argv[1]?.endsWith("remediate-seeded-accounts.ts")) {
  const isExecute = process.argv.includes("--execute");
  auditAndRemediateSeededAccounts({ execute: isExecute });
}
