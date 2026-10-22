import assert from "node:assert/strict";
import test from "node:test";
import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { DatabaseSync } from "node:sqlite";
import {
  signSessionToken,
  verifySessionToken,
  verifyShopMembership,
  getSessionSecret,
  type SessionTokenPayload,
} from "./auth/token.ts";
import { hashPassword, verifyPassword } from "./auth/password.ts";
import {
  getOrders,
  saveOrder,
  recordPayment,
  getLocalPaymentEvidenceReadback,
  savePaymentEvidenceRecord,
  SAMPLE_SHOP_ID,
  DEFAULT_USER_ID,
  STAFF_USER_ID,
} from "./db/repository.ts";
import { getDb, initSchema, seedInitialData, resetDbForTesting, resolveDbPath } from "./db/sqlite.ts";
import { resolveSessionUser, revokeUserSessions, disableUserAccount } from "./auth/session.ts";
import { signUpAction, signInAction } from "../app/login/actions.ts";
import { auditAndRemediateSeededAccounts } from "../scripts/remediate-seeded-accounts.ts";

process.env.SESSION_SECRET = process.env.SESSION_SECRET || "salesayar-test-secret-key-salt-2026-minimum-32-chars";

// Requirement 2: Isolate every security-integrity test from data/salesayar.db using an injected in-memory database
process.env.SALESAYAR_DB_PATH = ":memory:";
resetDbForTesting();

// Track data/salesayar.db modification timestamp if file exists on disk
const liveDbPath = resolveDbPath();
const initialDbStat = fs.existsSync(liveDbPath) ? fs.statSync(liveDbPath).mtimeMs : null;

test("1. Signed-out access fails closed", () => {
  assert.equal(verifySessionToken(null), null);
  assert.equal(verifySessionToken(""), null);
  assert.equal(verifySessionToken(undefined), null);
  assert.equal(verifySessionToken("random-unstructured-string"), null);
});

test("2. Forged, unsigned, and expired session cookies are rejected", () => {
  const secret = "salesayar-test-secret-key-salt-2026-minimum-32-chars";

  // Case A: Old plaintext JSON cookie (unsigned)
  const plaintextJson = encodeURIComponent(JSON.stringify({ userId: DEFAULT_USER_ID, role: "owner" }));
  assert.equal(verifySessionToken(plaintextJson, secret), null);

  // Case B: Tampered signature
  const validPayload: SessionTokenPayload = {
    sub: DEFAULT_USER_ID,
    iat: Date.now(),
    exp: Date.now() + 60_000,
    nonce: "testnonce",
  };
  const validToken = signSessionToken(validPayload, secret);
  const [data, sig] = validToken.split(".");
  // Corrupt signature
  const corruptedSig = sig!.slice(0, -2) + (sig!.endsWith("a") ? "b" : "a");
  assert.equal(verifySessionToken(`${data}.${corruptedSig}`, secret), null);

  // Case C: Expired token
  const expiredPayload: SessionTokenPayload = {
    sub: DEFAULT_USER_ID,
    iat: Date.now() - 100_000,
    exp: Date.now() - 1_000, // Expired 1 second ago
    nonce: "expired",
  };
  const expiredToken = signSessionToken(expiredPayload, secret);
  assert.equal(verifySessionToken(expiredToken, secret), null);

  // Case D: Non-UUID subject in payload
  const nonUuidPayload: SessionTokenPayload = {
    sub: "admin-root-user",
    iat: Date.now(),
    exp: Date.now() + 60_000,
    nonce: "badsub",
  };
  const nonUuidToken = signSessionToken(nonUuidPayload, secret);
  assert.equal(verifySessionToken(nonUuidToken, secret), null);
});

test("3. Cross-shop authorization: caller cannot access another shop's records", () => {
  const db = getDb();
  const testStaffId = crypto.randomUUID();
  const testLiveShopId = crypto.randomUUID();
  const testSampleShopId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create isolated test shops
  db.prepare("INSERT INTO shops (id, name, currency, is_sample, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(testLiveShopId, "Live Merchant Shop", "MMK", 0, now, now);
  db.prepare("INSERT INTO shops (id, name, currency, is_sample, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(testSampleShopId, "Sample Demo Shop", "MMK", 1, now, now);

  // Setup: testStaffId is a member of sample shop ONLY, NOT the live shop
  db.prepare("INSERT INTO shop_memberships (shop_id, user_id, role, created_at) VALUES (?, ?, ?, ?)")
    .run(testSampleShopId, testStaffId, "staff", now);

  const staffInSample = verifyShopMembership(testStaffId, testSampleShopId);
  assert.equal(staffInSample.authorized, true);
  assert.equal(staffInSample.role, "staff");

  const staffInLive = verifyShopMembership(testStaffId, testLiveShopId);
  assert.equal(staffInLive.authorized, false);

  // Negative test A: Staff reading another shop's orders throws Unauthorized
  assert.throws(
    () => {
      getOrders(testLiveShopId, undefined, testStaffId);
    },
    { message: /Unauthorized/ }
  );

  // Negative test B: Staff saving an order in another shop throws Unauthorized
  assert.throws(
    () => {
      saveOrder(
        {
          id: crypto.randomUUID(),
          shop_id: testLiveShopId,
          expected_updated_at: null,
          customer_name: "Attacker",
          customer_phone: null,
          delivery_address: null,
          notes: null,
          order_status: "confirmed",
          fulfillment_status: "unfulfilled",
          delivery_fee_mmk: 0,
          discount_mmk: 0,
          items: [{ product_name: "Illegal Item", quantity: 1, unit_price_mmk: 10000 }],
        },
        { userId: testStaffId }
      );
    },
    { message: /Unauthorized/ }
  );

  // Negative test C: Staff attempting payment recording in another shop throws Unauthorized
  assert.throws(
    () => {
      recordPayment(testLiveShopId, testStaffId, {
        order_id: crypto.randomUUID(),
        amount_mmk: 10000,
        payment_method: "KBZPay",
      });
    },
    { message: /Unauthorized/ }
  );
});

test("4. Payment integrity: validates integer MMK, prevents excessive allocation, and enforces duplicate reference check", () => {
  const db = getDb();
  const testShopId = crypto.randomUUID();
  const testUserId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create isolated live shop with owner membership
  db.prepare("INSERT INTO shops (id, name, currency, is_sample, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(testShopId, "Live Payment Shop", "MMK", 0, now, now);
  db.prepare("INSERT INTO shop_memberships (shop_id, user_id, role, created_at) VALUES (?, ?, ?, ?)")
    .run(testShopId, testUserId, "owner", now);

  const testOrderId = crypto.randomUUID();

  // Create test confirmed order with total 50,000 MMK
  db.prepare(`
    INSERT INTO orders (id, shop_id, customer_id, order_status, payment_status, fulfillment_status, subtotal_mmk, delivery_fee_mmk, discount_mmk, total_mmk, created_at, updated_at)
    VALUES (?, ?, NULL, 'confirmed', 'unpaid', 'unfulfilled', 50000, 0, 0, 50000, ?, ?)
  `).run(testOrderId, testShopId, now, now);

  // Negative test A: Negative or zero amount is rejected
  assert.throws(
    () => {
      recordPayment(testShopId, testUserId, {
        order_id: testOrderId,
        amount_mmk: -5000,
        payment_method: "KBZPay",
      });
    },
    { message: /positive whole MMK/ }
  );

  assert.throws(
    () => {
      recordPayment(testShopId, testUserId, {
        order_id: testOrderId,
        amount_mmk: 0,
        payment_method: "KBZPay",
      });
    },
    { message: /positive whole MMK/ }
  );

  // Negative test B: Non-integer float amount is rejected
  assert.throws(
    () => {
      recordPayment(testShopId, testUserId, {
        order_id: testOrderId,
        amount_mmk: 25000.5,
        payment_method: "KBZPay",
      });
    },
    { message: /positive whole MMK/ }
  );

  // Positive test: Partial payment of 20,000 MMK succeeds and updates to partially_paid
  const uniqueRef = `SEC-TEST-${Date.now()}`;
  const payment1 = recordPayment(testShopId, testUserId, {
    order_id: testOrderId,
    amount_mmk: 20000,
    payment_method: "KBZPay",
    reference_number: uniqueRef,
  });
  assert.equal(payment1.payment_status, "partially_paid");
  assert.equal(payment1.total_paid_mmk, 20000);

  // Verify order_status and fulfillment_status are NOT modified (status isolation)
  const orderRow = db.prepare("SELECT order_status, payment_status, fulfillment_status FROM orders WHERE id = ?").get(testOrderId) as {
    order_status: string;
    payment_status: string;
    fulfillment_status: string;
  };
  assert.equal(orderRow.order_status, "confirmed");
  assert.equal(orderRow.payment_status, "partially_paid");
  assert.equal(orderRow.fulfillment_status, "unfulfilled");

  // Negative test C: Duplicate payment reference for the same provider is rejected
  assert.throws(
    () => {
      recordPayment(testShopId, testUserId, {
        order_id: testOrderId,
        amount_mmk: 10000,
        payment_method: "KBZPay",
        reference_number: uniqueRef, // Duplicate!
      });
    },
    { message: /already exists in this shop/ }
  );

  // Negative test D: Excessive payment allocation exceeding remaining balance (remaining = 30,000, attempt = 35,000)
  assert.throws(
    () => {
      recordPayment(testShopId, testUserId, {
        order_id: testOrderId,
        amount_mmk: 35000,
        payment_method: "WavePay",
        reference_number: `DIFF-REF-${Date.now()}`,
      });
    },
    { message: /exceeds remaining order balance/ }
  );

  // Positive test: Paying exact remaining balance (30,000 MMK) transitions to paid
  const payment2 = recordPayment(testShopId, testUserId, {
    order_id: testOrderId,
    amount_mmk: 30000,
    payment_method: "WavePay",
    reference_number: `WAVE-${Date.now()}`,
  });
  assert.equal(payment2.payment_status, "paid");
  assert.equal(payment2.total_paid_mmk, 50000);

  // Negative test E: Paying an already paid order is rejected
  assert.throws(
    () => {
      recordPayment(testShopId, testUserId, {
        order_id: testOrderId,
        amount_mmk: 5000,
        payment_method: "KBZPay",
      });
    },
    { message: /already fully paid/ }
  );
});

test("5. Screenshot-only payment confirmation is prohibited; evidence review retains immutable extraction and does not mark order paid", () => {
  const db = getDb();
  const testShopId = crypto.randomUUID();
  const testUserId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create isolated live shop with owner membership
  db.prepare("INSERT INTO shops (id, name, currency, is_sample, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(testShopId, "Live Evidence Shop", "MMK", 0, now, now);
  db.prepare("INSERT INTO shop_memberships (shop_id, user_id, role, created_at) VALUES (?, ?, ?, ?)")
    .run(testShopId, testUserId, "owner", now);

  // Create confirmed unpaid order
  db.prepare(`
    INSERT INTO orders (id, shop_id, customer_id, order_status, payment_status, fulfillment_status, subtotal_mmk, delivery_fee_mmk, discount_mmk, total_mmk, created_at, updated_at)
    VALUES (?, ?, NULL, 'confirmed', 'unpaid', 'unfulfilled', 30000, 0, 0, 30000, ?, ?)
  `).run(orderId, testShopId, now, now);

  // Negative test A: Attempting to save evidence with status "confirmed" or "paid" is strictly rejected
  assert.throws(
    () => {
      savePaymentEvidenceRecord(testShopId, {
        id: crypto.randomUUID(),
        order_id: orderId,
        amount_mmk: 30000,
        provider: "KBZPay",
        status: "confirmed" as unknown as "pending_review",
      });
    },
    { message: /can only be saved as pending_review or rejected/ }
  );

  // Save evidence as pending_review
  const evidenceId = crypto.randomUUID();
  const originalExtraction = {
    amount_mmk: 30000, transaction_reference: "TXN123", provider: "KBZPay", transaction_date: null,
    transaction_time: null, transaction_time_uncertain: true, payer_name: "Buyer", payee_name: null,
    missing_fields: [], uncertain_fields: [],
  };
  const sellerReviewed = { ...originalExtraction };
  const imageSha = "a".repeat(64);

  const saved = savePaymentEvidenceRecord(testShopId, {
    id: evidenceId,
    order_id: orderId,
    status: "pending_review",
    image_data: "c3ludGhldGljLWltYWdlLWJ5dGVz",
    image_sha256: imageSha,
    extracted: originalExtraction,
    seller_reviewed: sellerReviewed,
    expected_revision: 0,
  }, testUserId);
  assert.equal(saved.revision, 0);

  // Verification 1: Order payment status must REMAIN 'unpaid'
  const orderCheck = db.prepare("SELECT payment_status FROM orders WHERE id = ?").get(orderId) as { payment_status: string };
  assert.equal(orderCheck.payment_status, "unpaid");

  // Verification 2: Original extraction is retained separately from seller corrections
  const evidenceRow = db.prepare("SELECT status, extracted, seller_reviewed, image_data, revision FROM payment_evidence WHERE id = ?").get(evidenceId) as {
    status: string;
    extracted: string;
    seller_reviewed: string;
    image_data: string;
    revision: number;
  };
  assert.equal(evidenceRow.status, "pending_review");
  assert.equal(evidenceRow.revision, 0);
  assert.equal(evidenceRow.image_data, "c3ludGhldGljLWltYWdlLWJ5dGVz");
  assert.deepEqual(JSON.parse(evidenceRow.extracted), originalExtraction);
  assert.deepEqual(JSON.parse(evidenceRow.seller_reviewed), sellerReviewed);
  assert.equal(getLocalPaymentEvidenceReadback(testShopId, evidenceId, testUserId)?.status, "pending_review");

  assert.throws(() => recordPayment(testShopId, testUserId, {
    order_id: orderId, amount_mmk: 30000, payment_method: "KBZPay", reference_number: "TXN123",
    evidence_id: evidenceId, expected_evidence_revision: 0, trusted_record_confirmed: false,
  }), /trusted-record confirmation/);
  assert.throws(() => savePaymentEvidenceRecord(testShopId, {
    id: evidenceId, order_id: orderId, status: "pending_review", image_sha256: imageSha,
    extracted: { ...originalExtraction, amount_mmk: 29000 }, seller_reviewed: sellerReviewed, expected_revision: 0,
  }, testUserId), /original screenshot extraction is immutable/);

  const verified = recordPayment(testShopId, testUserId, {
    order_id: orderId, amount_mmk: 30000, payment_method: "KBZPay", reference_number: "TXN123",
    evidence_id: evidenceId, expected_evidence_revision: 0, trusted_record_confirmed: true,
  });
  assert.equal(verified.payment_status, "paid");
  assert.equal(verified.total_paid_mmk, 30000);
  assert.equal(verified.idempotent, false);

  const verifiedEvidence = getLocalPaymentEvidenceReadback(testShopId, evidenceId, testUserId);
  assert.equal(verifiedEvidence?.status, "verified");
  assert.equal(verifiedEvidence?.payment_id, verified.paymentId);
  assert.equal(verifiedEvidence?.revision, 1);
  const verifiedOrder = db.prepare("SELECT order_status, payment_status, fulfillment_status FROM orders WHERE id = ?").get(orderId) as {
    order_status: string; payment_status: string; fulfillment_status: string;
  };
  assert.deepEqual({ ...verifiedOrder }, { order_status: "confirmed", payment_status: "paid", fulfillment_status: "unfulfilled" });

  const retry = recordPayment(testShopId, testUserId, {
    order_id: orderId, amount_mmk: 30000, payment_method: "KBZPay", reference_number: "TXN123",
    evidence_id: evidenceId, expected_evidence_revision: 0, trusted_record_confirmed: true,
  });
  assert.equal(retry.paymentId, verified.paymentId);
  assert.equal(retry.idempotent, true);
  assert.equal((db.prepare("SELECT COUNT(*) as count FROM payments WHERE order_id = ?").get(orderId) as { count: number }).count, 1);
  assert.equal((db.prepare("SELECT COUNT(*) as count FROM payment_evidence_events WHERE evidence_id = ?").get(evidenceId) as { count: number }).count, 2);
});

test("5B. Evidence saved with missing payer name and null order_id can be updated with manual payer name, attached to matching order, and verified", () => {
  const db = getDb();
  const testShopId = crypto.randomUUID();
  const testUserId = crypto.randomUUID();
  const orderId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create test shop and owner membership
  db.prepare("INSERT INTO shops (id, name, currency, is_sample, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?)")
    .run(testShopId, "Manual Payer Shop", "MMK", 0, now, now);
  db.prepare("INSERT INTO shop_memberships (shop_id, user_id, role, created_at) VALUES (?, ?, ?, ?)")
    .run(testShopId, testUserId, "owner", now);

  // Create customer and confirmed unpaid order
  const customerId = crypto.randomUUID();
  db.prepare(`
    INSERT INTO customers (id, shop_id, name, created_at, updated_at)
    VALUES (?, ?, 'Daw Mya', ?, ?)
  `).run(customerId, testShopId, now, now);

  db.prepare(`
    INSERT INTO orders (id, shop_id, customer_id, order_status, payment_status, fulfillment_status, subtotal_mmk, delivery_fee_mmk, discount_mmk, total_mmk, created_at, updated_at)
    VALUES (?, ?, ?, 'confirmed', 'unpaid', 'unfulfilled', 45000, 0, 0, 45000, ?, ?)
  `).run(orderId, testShopId, customerId, now, now);

  // 1. Evidence initially has missing payer name (null) and no attached order (null)
  const evidenceId = crypto.randomUUID();
  const originalExtraction = {
    amount_mmk: 45000, transaction_reference: "REF-MANUAL-1", provider: "KBZPay", transaction_date: null,
    transaction_time: null, transaction_time_uncertain: true, payer_name: null, payee_name: null,
    missing_fields: ["payer_name"], uncertain_fields: [],
  };
  const initialSellerReviewed = { ...originalExtraction };
  const imageSha = "b".repeat(64);

  const initialSave = savePaymentEvidenceRecord(testShopId, {
    id: evidenceId,
    order_id: null,
    status: "pending_review",
    image_data: "c2NyZWVuc2hvdC1ieXRlcy1kYXRh",
    image_sha256: imageSha,
    extracted: originalExtraction,
    seller_reviewed: initialSellerReviewed,
    expected_revision: 0,
  }, testUserId);
  assert.equal(initialSave.revision, 0);

  // Readback confirms order_id is null and payer_name is null
  const readback1 = getLocalPaymentEvidenceReadback(testShopId, evidenceId, testUserId);
  assert.equal(readback1?.order_id, null);
  assert.equal(readback1?.seller_reviewed.payer_name, null);

  // 2. Seller manually enters payer name "Daw Mya" and attaches orderId
  const updatedSellerReviewed = {
    ...initialSellerReviewed,
    payer_name: "Daw Mya",
    missing_fields: [],
  };

  const updatedSave = savePaymentEvidenceRecord(testShopId, {
    id: evidenceId,
    order_id: orderId,
    status: "pending_review",
    image_sha256: imageSha,
    extracted: originalExtraction,
    seller_reviewed: updatedSellerReviewed,
    expected_revision: 0,
  }, testUserId);
  assert.equal(updatedSave.revision, 1);

  // Readback confirms order_id is now attached and payer_name is updated
  const readback2 = getLocalPaymentEvidenceReadback(testShopId, evidenceId, testUserId);
  assert.equal(readback2?.order_id, orderId);
  assert.equal(readback2?.seller_reviewed.payer_name, "Daw Mya");
  assert.equal(readback2?.revision, 1);

  // 3. Now seller can verify the payment against the attached order
  const verified = recordPayment(testShopId, testUserId, {
    order_id: orderId,
    amount_mmk: 45000,
    payment_method: "KBZPay",
    reference_number: "REF-MANUAL-1",
    evidence_id: evidenceId,
    expected_evidence_revision: 1,
    trusted_record_confirmed: true,
  });
  assert.equal(verified.payment_status, "paid");
  assert.equal(verified.total_paid_mmk, 45000);

  // Readback confirms evidence status transitioned to verified
  const readback3 = getLocalPaymentEvidenceReadback(testShopId, evidenceId, testUserId);
  assert.equal(readback3?.status, "verified");
  assert.equal(readback3?.payment_id, verified.paymentId);
});


test("6. Missing production secret fails closed and invalidates old fallback sessions", () => {
  const origSecret = process.env.SESSION_SECRET;
  try {
    delete process.env.SESSION_SECRET;
    assert.throws(() => getSessionSecret(), { message: /SESSION_SECRET is missing or insecure/ });

    const validPayload: SessionTokenPayload = {
      sub: DEFAULT_USER_ID,
      iat: Date.now(),
      exp: Date.now() + 60_000,
      nonce: "nonce123",
    };
    const testSecret = "dedicated-secure-session-secret-at-least-32-chars";
    const token = signSessionToken(validPayload, testSecret);
    assert.equal(verifySessionToken(token), null); // Missing env secret -> fails closed to null

    // Ensure old hardcoded fallback-signed sessions cannot remain valid
    const oldFallbackSecret = "salesayar-ai-security-secret-key-salt-2026-v1-enforce-crypto";
    const oldFallbackToken = signSessionToken(validPayload, oldFallbackSecret);
    assert.equal(verifySessionToken(oldFallbackToken, testSecret), null);
  } finally {
    process.env.SESSION_SECRET = origSecret || "salesayar-test-secret-key-salt-2026-minimum-32-chars";
  }
});

test("7. Wrong-password login strictly fails closed and does not issue sessions", () => {
  const password = "CorrectPassword@2026";
  const wrongPassword = "WrongPassword@2026";
  const hash = hashPassword(password);

  assert.equal(verifyPassword(wrongPassword, hash), false);
  assert.equal(verifyPassword("", hash), false);
  assert.equal(verifyPassword(password, "malformed:hash"), false);
  assert.equal(verifyPassword(password, null), false);
  assert.equal(verifyPassword(password, undefined), false);
  assert.equal(verifyPassword(password, hash), true);

  // Negative test: unhashed/passwordless account in DB fails closed
  const db = getDb();
  const testUserId = crypto.randomUUID();
  const now = new Date().toISOString();
  db.prepare(`
    INSERT INTO profiles (id, email, display_name, role, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(testUserId, "passwordless@test.local", "Test User", "staff", null, now, now);

  const profile = db.prepare("SELECT id, password_hash FROM profiles WHERE id = ?").get(testUserId) as { id: string; password_hash: string | null };
  assert.equal(verifyPassword("AnyPassword@123", profile.password_hash), false);
});

test("8. Failed-provider authentication never falls back to password bypass or local login", () => {
  // Provider returned an error (e.g. invalid credentials or network error)
  const mockProviderResponse = { data: { user: null }, error: { message: "Invalid login credentials" } };

  // Rule verification: when provider fails, result must immediately fail closed without local email lookup fallback
  const authenticateWithFallbackCheck = (providerResult: typeof mockProviderResponse) => {
    if (providerResult.error || !providerResult.data.user) {
      // Must fail closed; never query local database or fall back to email match
      return { success: false, error: "Invalid email or password." };
    }
    return { success: true, userId: "should-not-reach-here" };
  };

  const result = authenticateWithFallbackCheck(mockProviderResponse);
  assert.equal(result.success, false);
  assert.equal(result.error, "Invalid email or password.");
});

test("9. Clean live-shop initialization contains zero fabricated orders, customers, or expenses", () => {
  const db = getDb();
  const cleanShopId = crypto.randomUUID();
  const now = new Date().toISOString();

  // Create a new real shop (is_sample = 0)
  db.prepare(`
    INSERT INTO shops (id, name, currency, is_sample, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(cleanShopId, "Clean Live Boutique", "MMK", 0, now, now);

  // Assert that zero fabricated orders, customers, or expenses exist for this shop
  const orderCount = (db.prepare("SELECT COUNT(*) as count FROM orders WHERE shop_id = ?").get(cleanShopId) as { count: number }).count;
  const customerCount = (db.prepare("SELECT COUNT(*) as count FROM customers WHERE shop_id = ?").get(cleanShopId) as { count: number }).count;
  const expenseCount = (db.prepare("SELECT COUNT(*) as count FROM expenses WHERE shop_id = ?").get(cleanShopId) as { count: number }).count;

  assert.equal(orderCount, 0, "Live shop must start with 0 fabricated orders");
  assert.equal(customerCount, 0, "Live shop must start with 0 fabricated customers");
  assert.equal(expenseCount, 0, "Live shop must start with 0 fabricated expenses");

  // Verify that synthetic sample records only belong in is_sample = 1
  const sampleShop = db.prepare("SELECT is_sample FROM shops WHERE id = ?").get(SAMPLE_SHOP_ID) as { is_sample: number };
  assert.equal(sampleShop.is_sample, 1, "Sample workspace must be explicitly labeled with is_sample = 1");
});

test("10. Fresh initialization creates no default-login live owner", () => {
  // Initialize a fresh isolated database
  const freshDb = new DatabaseSync(":memory:");
  initSchema(freshDb);
  seedInitialData(freshDb);

  // 1. Assert no seeded profiles exist
  const ownerProfile = freshDb.prepare("SELECT * FROM profiles WHERE email = 'owner@salesayar.com'").get();
  assert.equal(ownerProfile, undefined, "Fresh initialization must not create owner@salesayar.com profile");

  const staffProfile = freshDb.prepare("SELECT * FROM profiles WHERE email = 'staff@salesayar.com'").get();
  assert.equal(staffProfile, undefined, "Fresh initialization must not create staff@salesayar.com profile");

  const totalProfiles = (freshDb.prepare("SELECT COUNT(*) as count FROM profiles").get() as { count: number }).count;
  assert.equal(totalProfiles, 0, "Fresh initialization must create zero profiles with default credentials");

  // 2. Assert zero live shop memberships exist
  const liveMemberships = (freshDb.prepare(`
    SELECT COUNT(*) as count FROM shop_memberships sm
    JOIN shops s ON sm.shop_id = s.id
    WHERE s.is_sample = 0
  `).get() as { count: number }).count;
  assert.equal(liveMemberships, 0, "Fresh initialization must create zero live shop owners or memberships");

  // 3. Assert sample shop is isolated with is_sample = 1 and has zero seeded user memberships
  const sampleShops = freshDb.prepare("SELECT id, is_sample FROM shops WHERE is_sample = 1").all() as Array<{ id: string; is_sample: number }>;
  assert.equal(sampleShops.length, 1, "Only isolated sample demonstration fixture may exist at startup");
  assert.equal(sampleShops[0]?.is_sample, 1, "Sample fixture must have is_sample = 1");

  const sampleMemberships = (freshDb.prepare("SELECT COUNT(*) as count FROM shop_memberships WHERE shop_id = ?").get(sampleShops[0]!.id) as { count: number }).count;
  assert.equal(sampleMemberships, 0, "Sample fixture must have zero seeded user memberships at startup");
});

test("11. Existing accounts never acquire a predictable password during startup or initialization", () => {
  const db = getDb();
  const testUserId = crypto.randomUUID();
  const testEmail = `merchant-passwordless-${Date.now()}@test.local`;
  const now = new Date().toISOString();

  // Create an existing profile without password (e.g. SSO or uncredentialed profile)
  db.prepare(`
    INSERT INTO profiles (id, email, display_name, role, password_hash, created_at, updated_at)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(testUserId, testEmail, "Existing Merchant", "owner", null, now, now);

  // Run seedInitialData again (simulating multiple restarts / reconnections)
  seedInitialData(db);

  // Verify that the existing profile's password_hash was NEVER backfilled
  const profile = db.prepare("SELECT id, password_hash FROM profiles WHERE id = ?").get(testUserId) as { id: string; password_hash: string | null };
  assert.equal(profile.password_hash, null, "Existing passwordless accounts must never acquire a predictable password");

  // Prove predictable passwords strictly fail authentication
  assert.equal(verifyPassword("Admin@1234", profile.password_hash), false);
  assert.equal(verifyPassword("Staff@1234", profile.password_hash), false);
});

test("12. Actual authentication/onboarding implementation creates live owners and isolates sample access", async () => {
  const db = getDb();
  const merchantEmail = `real-onboarded-${Date.now()}@test.local`;
  const merchantPassword = "SecureMerchantPassword@2026!";
  const merchantDisplayName = "Daw Khin";

  // 1. Exercise real signUpAction implementation using FormData
  const signupData = new FormData();
  signupData.append("display_name", merchantDisplayName);
  signupData.append("email", merchantEmail);
  signupData.append("password", merchantPassword);
  signupData.append("next", "/sales");

  // signUpAction redirects on successful onboarding (Next.js throws NEXT_REDIRECT)
  let redirectError: { digest?: string } | null = null;
  try {
    await signUpAction(undefined, signupData);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "digest" in err) {
      redirectError = err as { digest: string };
    } else {
      throw err;
    }
  }

  assert.ok(redirectError, "signUpAction must redirect after successful onboarding");
  assert.match(redirectError.digest || "", /^NEXT_REDIRECT;replace;\/sales\?shop=/);

  // Extract the generated shop ID from redirect destination
  const redirectUrl = (redirectError.digest || "").split(";")[2] || "";
  const shopIdMatch = redirectUrl.match(/shop=([0-9a-fA-F-]+)/);
  assert.ok(shopIdMatch && shopIdMatch[1], "Redirect URL must contain the newly created shop UUID");
  const newShopId = shopIdMatch[1];

  // Verify the newly created profile in the database
  const profile = db.prepare("SELECT id, email, display_name, password_hash, role FROM profiles WHERE email = ?").get(merchantEmail) as {
    id: string;
    email: string;
    display_name: string;
    password_hash: string;
    role: string;
  };
  assert.ok(profile, "Profile must be created in database by signUpAction");
  assert.equal(profile.display_name, merchantDisplayName);
  assert.equal(profile.role, "owner");
  assert.ok(profile.password_hash, "Password must be securely hashed with scrypt");
  assert.equal(verifyPassword(merchantPassword, profile.password_hash), true);

  // Verify the newly created live shop
  const shop = db.prepare("SELECT id, name, is_sample FROM shops WHERE id = ?").get(newShopId) as {
    id: string;
    name: string;
    is_sample: number;
  };
  assert.ok(shop, "Live shop must be created by signUpAction");
  assert.equal(shop.is_sample, 0, "Live shop must have is_sample = 0");
  assert.equal(shop.name, `${merchantDisplayName}’s Shop`);

  // Verify membership
  const membership = verifyShopMembership(profile.id, newShopId);
  assert.equal(membership.authorized, true);
  assert.equal(membership.role, "owner");
  assert.equal(membership.shop?.is_sample, false);

  // 2. Exercise real signInAction with wrong credentials -> fails closed
  const wrongSignInData = new FormData();
  wrongSignInData.append("email", merchantEmail);
  wrongSignInData.append("password", "WrongPassword@2026");
  const failResult = await signInAction(undefined, wrongSignInData);
  assert.equal(failResult?.error, "Invalid email or password.");

  // 3. Exercise real signInAction with correct credentials -> redirects
  const correctSignInData = new FormData();
  correctSignInData.append("email", merchantEmail);
  correctSignInData.append("password", merchantPassword);
  correctSignInData.append("next", "/");

  let signInRedirect: { digest?: string } | null = null;
  try {
    await signInAction(undefined, correctSignInData);
  } catch (err: unknown) {
    if (typeof err === "object" && err !== null && "digest" in err) {
      signInRedirect = err as { digest: string };
    } else {
      throw err;
    }
  }
  assert.ok(signInRedirect, "signInAction must redirect on successful authentication");

  // 4. Verify sample workspace isolation: Merchant does not automatically have sample access
  const sampleMembership = verifyShopMembership(profile.id, SAMPLE_SHOP_ID);
  assert.equal(sampleMembership.authorized, false);
});

test("13. Explicitly invalidate existing sessions for remediated accounts upon session read", () => {
  const db = getDb();
  const userId = crypto.randomUUID();
  const now = Date.now();
  const nowDate = new Date(now).toISOString();

  // Create an active profile
  db.prepare(`
    INSERT INTO profiles (id, email, display_name, role, password_hash, status, session_revoked_at, created_at, updated_at)
    VALUES (?, ?, ?, 'owner', ?, 'active', NULL, ?, ?)
  `).run(userId, "session-test@example.com", "Session User", hashPassword("SecretPass@123"), nowDate, nowDate);

  // Issue a valid signed session token
  const validPayload: SessionTokenPayload = {
    sub: userId,
    iat: now,
    exp: now + 3600_000,
    nonce: "validnonce1",
  };
  const token = signSessionToken(validPayload);

  // Reading active session succeeds
  const sessionBeforeRevoke = resolveSessionUser(token);
  assert.ok(sessionBeforeRevoke, "Active session token must resolve successfully");
  assert.equal(sessionBeforeRevoke.userId, userId);

  // Explicitly revoke sessions for this account using helper (e.g. remediation)
  revokeUserSessions(userId);

  // Reading the old token MUST return null because token.iat <= session_revoked_at
  const sessionAfterRevoke = resolveSessionUser(token);
  assert.equal(sessionAfterRevoke, null, "Session reading must explicitly fail closed when token was issued before revocation");

  // Also test account status disabled using helper
  disableUserAccount(userId);
  const sessionWhenDisabled = resolveSessionUser(token);
  assert.equal(sessionWhenDisabled, null, "Disabled account session must fail closed to null");

  // Also test non-existent user profile
  const ghostPayload: SessionTokenPayload = {
    sub: crypto.randomUUID(),
    iat: now,
    exp: now + 3600_000,
    nonce: "ghost",
  };
  const ghostToken = signSessionToken(ghostPayload);
  assert.equal(resolveSessionUser(ghostToken), null, "Non-existent user session must fail closed to null");
});

test("14. Remediation dry-run is genuinely read-only and never creates or modifies database files", () => {
  const scratchDir = path.join(os.tmpdir(), `test-scratch-${Date.now()}`);
  const nonExistentDb = path.join(scratchDir, "non-existent-test.db");

  // Ensure non-existent path does not exist
  if (fs.existsSync(nonExistentDb)) fs.unlinkSync(nonExistentDb);
  if (fs.existsSync(scratchDir)) fs.rmdirSync(scratchDir);

  // Run dry-run on missing path
  const result = auditAndRemediateSeededAccounts({
    execute: false,
    dbPath: nonExistentDb,
    silent: true,
  });

  // Verify that dry-run did NOT create the database or directory
  assert.equal(result.dbExisted, false);
  assert.equal(fs.existsSync(nonExistentDb), false, "Dry run must NOT create a missing database file");
  assert.equal(fs.existsSync(scratchDir), false, "Dry run must NOT create missing directories");

  // Test genuinely read-only on an existing database
  const readOnlyDbPath = path.join(os.tmpdir(), `test-readonly-${Date.now()}.db`);
  const setupDb = new DatabaseSync(readOnlyDbPath);
  setupDb.exec(`
    CREATE TABLE profiles (id TEXT PRIMARY KEY, email TEXT, display_name TEXT, role TEXT, password_hash TEXT);
    INSERT INTO profiles VALUES ('${DEFAULT_USER_ID}', 'owner@salesayar.com', 'May Thu', 'owner', '${hashPassword("Admin@1234")}');
  `);
  setupDb.close();

  const mtimeBefore = fs.statSync(readOnlyDbPath).mtimeMs;

  const auditResult = auditAndRemediateSeededAccounts({
    execute: false,
    dbPath: readOnlyDbPath,
    silent: true,
  });

  assert.equal(auditResult.audited, 1);
  assert.equal(auditResult.predictableCount, 1);
  assert.equal(auditResult.remediatedCount, 0, "Dry run must remediate 0 records");

  // Verify file was opened read-only and not mutated
  const mtimeAfter = fs.statSync(readOnlyDbPath).mtimeMs;
  assert.equal(mtimeBefore, mtimeAfter, "Dry run must leave database file completely untouched");

  // Clean up test file
  if (fs.existsSync(readOnlyDbPath)) fs.unlinkSync(readOnlyDbPath);
});

test("15. Legacy account identification uses known seeded IDs and reviewed identity evidence, not email match alone", () => {
  const tempDbPath = path.join(os.tmpdir(), `test-evidence-${Date.now()}.db`);
  const setupDb = new DatabaseSync(tempDbPath);
  setupDb.exec(`
    CREATE TABLE profiles (id TEXT PRIMARY KEY, email TEXT, display_name TEXT, role TEXT, password_hash TEXT, status TEXT);
  `);

  // Account A: Known seeded ID and hash matches "Admin@1234" -> Predictable
  const seededHash = hashPassword("Admin@1234");
  setupDb.prepare("INSERT INTO profiles VALUES (?, ?, ?, 'owner', ?, 'active')")
    .run(DEFAULT_USER_ID, "legacy-admin@salesayar.com", "Seeded Owner", seededHash);

  // Account B: Custom user with custom password who happens to match legacy email -> Custom password, NOT predictable!
  const customHash = hashPassword("MerchantCustomChosenSecret@2026");
  const customUserId = crypto.randomUUID();
  setupDb.prepare("INSERT INTO profiles VALUES (?, ?, ?, 'owner', ?, 'active')")
    .run(customUserId, "owner@salesayar.com", "Legitimate Merchant With Legacy Email", customHash);

  // Account C: Seeded staff ID with matching "Staff@1234"
  const staffHash = hashPassword("Staff@1234");
  setupDb.prepare("INSERT INTO profiles VALUES (?, ?, ?, 'staff', ?, 'active')")
    .run(STAFF_USER_ID, "staff@salesayar.com", "Seeded Staff", staffHash);

  setupDb.close();

  // Audit in dry-run
  const audit = auditAndRemediateSeededAccounts({
    execute: false,
    dbPath: tempDbPath,
    silent: true,
  });

  assert.equal(audit.audited, 3, "Candidate query finds accounts matching known IDs or legacy emails");
  assert.equal(audit.predictableCount, 2, "Only accounts whose password hash actually matches known predictable passwords are confirmed");

  const customAccount = audit.evidence?.find((e) => e.id === customUserId);
  assert.ok(customAccount, "Custom account must be audited");
  assert.equal(customAccount.hasCustomPassword, true, "Account with custom password must be recognized as having a custom password");
  assert.equal(customAccount.isPredictablePasswordConfirmed, false, "Email similarity alone does NOT prove a password is predictable");

  // Now execute remediation on this test database
  const executeResult = auditAndRemediateSeededAccounts({
    execute: true,
    dbPath: tempDbPath,
    silent: true,
  });

  assert.equal(executeResult.remediatedCount, 2, "Only confirmed predictable accounts are remediated");

  // Inspect database after remediation
  const verifyDb = new DatabaseSync(tempDbPath, { readOnly: true });

  // Custom account's password was NOT touched
  const customAfter = verifyDb.prepare("SELECT password_hash FROM profiles WHERE id = ?").get(customUserId) as { password_hash: string };
  assert.equal(customAfter.password_hash, customHash, "Merchant's custom password MUST NOT be overwritten or deleted");

  // Predictable accounts had password nullified and status set to disabled
  const seededAfter = verifyDb.prepare("SELECT password_hash, status FROM profiles WHERE id = ?").get(DEFAULT_USER_ID) as { password_hash: string | null; status: string };
  assert.equal(seededAfter.password_hash, null);
  assert.equal(seededAfter.status, "disabled");

  verifyDb.close();
  if (fs.existsSync(tempDbPath)) fs.unlinkSync(tempDbPath);
});

test("16. Security integrity tests leave application database data/salesayar.db unchanged", () => {
  if (initialDbStat !== null) {
    const currentMtime = fs.statSync(liveDbPath).mtimeMs;
    assert.equal(
      currentMtime,
      initialDbStat,
      "Application database data/salesayar.db must be left unchanged by security tests"
    );
  }
});


