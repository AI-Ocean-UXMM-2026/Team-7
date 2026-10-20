import assert from "node:assert/strict";
import test from "node:test";
import { matchScreenshotOrders } from "./screenshot-match.ts";

const orders = [
  { id: "20000000-0000-4000-8000-000000000002", customer_name: "Thiri Mon", customer_phone: "09 777", total_mmk: 52000, order_status: "confirmed" as const, payment_status: "unpaid" as const, fulfillment_status: "unfulfilled" as const },
  { id: "20000000-0000-4000-8000-000000000003", customer_name: "Other buyer", customer_phone: null, total_mmk: 52000, order_status: "confirmed" as const, payment_status: "paid" as const, fulfillment_status: "delivered" as const },
  { id: "20000000-0000-4000-8000-000000000004", customer_name: "Draft buyer", customer_phone: null, total_mmk: 51000, order_status: "draft" as const, payment_status: "unpaid" as const, fulfillment_status: "unfulfilled" as const },
];

test("matching is deterministic, amount/customer explainable, and payment status stays untouched", () => {
  const result = matchScreenshotOrders(orders, {
    amount_mmk: 52000, transaction_reference: "TX-1", provider: "KBZPay", payer_name: "Thiri Mon",
  });
  assert.equal(result.candidates[0]?.order_id, orders[0]?.id);
  assert.equal(result.candidates[0]?.match_state, "exact");
  assert.equal(result.candidates[0]?.customer_relation, "match");
  assert.equal(result.candidates[0]?.reference_relation, "unavailable");
  assert.equal(result.candidates[1]?.eligible, false);
  assert.equal(result.candidates[1]?.match_state, "ineligible");
});

test("missing amount is uncertain and duplicate warnings remain same-shop scoped", () => {
  const result = matchScreenshotOrders(orders, {
    amount_mmk: null, transaction_reference: "TX-1", provider: "KBZPay", payer_name: null,
  }, [{ sha256: "a".repeat(64), status: "pending_review", seller_reviewed: { transaction_reference: "TX-1", provider: "KBZPay" } }]);
  assert.equal(result.candidates[0]?.match_state, "uncertain");
  assert.equal(result.candidates[0]?.amount_relation, "missing");
  assert.equal(result.duplicate_warnings[0]?.status, "pending_review");
  assert.equal(result.candidates[0]?.duplicate_warning, "pending_evidence");
});

test("close amounts remain possible rather than claiming a verified payment", () => {
  const result = matchScreenshotOrders([orders[0]!], {
    amount_mmk: 52800, transaction_reference: null, provider: null, payer_name: "Thiri Mon",
  });
  assert.equal(result.candidates[0]?.amount_relation, "close");
  assert.equal(result.candidates[0]?.match_state, "possible");
});

test("duplicate checks use corrected seller-reviewed reference and provider", () => {
  const existing = [{
    sha256: "a".repeat(64),
    status: "pending_review" as const,
    seller_reviewed: { transaction_reference: "CORRECTED-1", provider: "WavePay" },
  }];
  const corrected = matchScreenshotOrders([], {
    amount_mmk: 52000, transaction_reference: "corrected-1", provider: " wavepay ", payer_name: null,
  }, existing);
  assert.equal(corrected.duplicate_warnings[0]?.type, "reference_provider");

  const originalValue = matchScreenshotOrders([], {
    amount_mmk: 52000, transaction_reference: "ORIGINAL-1", provider: "KBZPay", payer_name: null,
  }, existing);
  assert.equal(originalValue.duplicate_warnings.length, 0);
});
