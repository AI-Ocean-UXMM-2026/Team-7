import assert from "node:assert/strict";
import crypto from "node:crypto";
import test from "node:test";
import { resetDbForTesting } from "../db/sqlite.ts";
import { acceptAssistantChallenge, redeemAssistantVerifier } from "./assistant-pairing.ts";

test("assistant pairing requires browser acceptance and a one-time verifier", () => {
  const db = resetDbForTesting();
  const user = crypto.randomUUID();
  db.prepare("INSERT INTO profiles (id,email,display_name,status) VALUES (?,?,?,'active')").run(user, "seller@test.invalid", "Seller");
  const verifier = crypto.randomBytes(32).toString("hex");
  const challenge = crypto.createHash("sha256").update(Buffer.from(verifier, "hex")).digest("hex");
  assert.equal(redeemAssistantVerifier(verifier, 1000), null);
  assert.equal(acceptAssistantChallenge(challenge, user, 1000), true);
  assert.equal(redeemAssistantVerifier(crypto.randomBytes(32).toString("hex"), 1001), null);
  assert.equal(redeemAssistantVerifier(verifier, 1001), user);
  assert.equal(redeemAssistantVerifier(verifier, 1002), null);
  assert.equal(acceptAssistantChallenge(challenge, user, 1003), false);
  assert.equal(acceptAssistantChallenge(challenge, crypto.randomUUID(), 1003), false);
});

test("assistant pairing expires and rejects disabled accounts", () => {
  const db = resetDbForTesting();
  const user = crypto.randomUUID();
  db.prepare("INSERT INTO profiles (id,email,display_name,status) VALUES (?,?,?,'active')").run(user, "seller2@test.invalid", "Seller");
  const verifier = crypto.randomBytes(32).toString("hex");
  const challenge = crypto.createHash("sha256").update(Buffer.from(verifier, "hex")).digest("hex");
  assert.equal(acceptAssistantChallenge(challenge, user, 1000), true);
  assert.equal(redeemAssistantVerifier(verifier, 121001), null);
  const other = crypto.randomBytes(32).toString("hex");
  assert.equal(acceptAssistantChallenge(crypto.createHash("sha256").update(Buffer.from(other, "hex")).digest("hex"), user, 122000), true);
  db.prepare("UPDATE profiles SET status = 'disabled' WHERE id = ?").run(user);
  assert.equal(redeemAssistantVerifier(other, 122001), null);
});
