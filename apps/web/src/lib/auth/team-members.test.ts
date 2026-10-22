import test from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import { DatabaseSync } from "node:sqlite";
import { initSchema, setDb } from "../db/sqlite.ts";
import { ensureLocalProfile } from "./local-profile.ts";

test("Team Membership and Invitation CRUD & Auto-Redemption Flow", () => {
  // Setup in-memory isolated test database
  const testDb = new DatabaseSync(":memory:");
  testDb.exec("PRAGMA foreign_keys = ON;");
  initSchema(testDb);
  setDb(testDb);

  const now = new Date().toISOString();

  // 1. Create shop owner profile and shop
  const ownerId = crypto.randomUUID();
  const shopId = crypto.randomUUID();
  testDb.prepare(`
    INSERT INTO profiles (id, email, display_name, role, status, created_at, updated_at)
    VALUES (?, ?, ?, 'owner', 'active', ?, ?)
  `).run(ownerId, "owner@example.com", "Shop Owner", now, now);

  testDb.prepare(`
    INSERT INTO shops (id, name, currency, is_sample, created_at, updated_at)
    VALUES (?, 'Owner Store', 'MMK', 0, ?, ?)
  `).run(shopId, now, now);

  testDb.prepare(`
    INSERT INTO shop_memberships (shop_id, user_id, role, created_at)
    VALUES (?, ?, 'owner', ?)
  `).run(shopId, ownerId, now);

  // 2. CREATE (Invite): Owner invites a new colleague who has not signed up yet
  const inviteId = crypto.randomUUID();
  const invitedEmail = "assistant.staff@example.com";
  testDb.prepare(`
    INSERT INTO shop_invitations (id, shop_id, email, role, created_at, created_by)
    VALUES (?, ?, ?, 'staff', ?, ?)
  `).run(inviteId, shopId, invitedEmail, now, ownerId);

  // READ: Query pending invitations
  const pendingInvites = testDb.prepare(`
    SELECT id, email, role FROM shop_invitations WHERE shop_id = ?
  `).all(shopId) as Array<{ id: string; email: string; role: string }>;

  assert.equal(pendingInvites.length, 1);
  assert.equal(pendingInvites[0]?.email, invitedEmail);
  assert.equal(pendingInvites[0]?.role, "staff");

  // 3. AUTO-REDEMPTION: The invited person signs up / logs in
  const invitedUserId = crypto.randomUUID();
  ensureLocalProfile({
    id: invitedUserId,
    email: invitedEmail,
    user_metadata: { full_name: "Assistant Staff" },
  });

  // Verify invitation is auto-redeemed: removed from invitations and added to memberships
  const remainingInvites = testDb.prepare(`
    SELECT COUNT(*) as count FROM shop_invitations WHERE shop_id = ?
  `).get(shopId) as { count: number };
  assert.equal(remainingInvites.count, 0, "Invitation should be removed upon auto-redemption");

  const memberRow = testDb.prepare(`
    SELECT role FROM shop_memberships WHERE shop_id = ? AND user_id = ?
  `).get(shopId, invitedUserId) as { role: string } | undefined;
  assert.ok(memberRow, "Invited user must now be an active shop member");
  assert.equal(memberRow.role, "staff");

  // 4. UPDATE: Owner promotes staff to admin
  testDb.prepare(`
    UPDATE shop_memberships SET role = 'admin' WHERE shop_id = ? AND user_id = ?
  `).run(shopId, invitedUserId);

  const updatedRole = testDb.prepare(`
    SELECT role FROM shop_memberships WHERE shop_id = ? AND user_id = ?
  `).get(shopId, invitedUserId) as { role: string };
  assert.equal(updatedRole.role, "admin");

  // 5. DELETE: Owner removes the member from the shop
  testDb.prepare(`
    DELETE FROM shop_memberships WHERE shop_id = ? AND user_id = ?
  `).run(shopId, invitedUserId);

  const deletedMember = testDb.prepare(`
    SELECT role FROM shop_memberships WHERE shop_id = ? AND user_id = ?
  `).get(shopId, invitedUserId);
  assert.equal(deletedMember, undefined, "Member should be removed from shop_memberships");

  // Clean up
  setDb(null);
});
