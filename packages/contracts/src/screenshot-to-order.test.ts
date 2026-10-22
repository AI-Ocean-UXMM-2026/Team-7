import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPaymentEvidenceSavePayload,
  paymentEvidenceSaveSchema,
  paymentEvidenceVerifyReadbackSchema,
  paymentEvidenceVerifyRequestSchema,
  screenshotAnalyzeResponseSchema,
  screenshotExtractionSchema,
  screenshotMimeSchema,
} from "./index.ts";

const extraction = {
  amount_mmk: 52000,
  transaction_reference: "TX-123",
  provider: "KBZPay",
  transaction_date: "2026-10-21",
  transaction_time: "10:20:00",
  transaction_time_uncertain: false,
  payer_name: "Thiri Mon",
  payee_name: "တူတူတွက်မယ်",
  missing_fields: [],
  uncertain_fields: [],
};

test("screenshot contracts keep missing values nullable and payment statuses bounded", () => {
  assert.equal(screenshotMimeSchema.safeParse("image/gif").success, false);
  assert.equal(screenshotExtractionSchema.safeParse({ ...extraction, amount_mmk: null, transaction_reference: null }).success, true);
  assert.equal(screenshotExtractionSchema.safeParse({ ...extraction, amount_mmk: 1.5 }).success, false);
  assert.equal(screenshotAnalyzeResponseSchema.safeParse({
    mode: "simulation", extraction, candidates: [], duplicate_warnings: [], image_sha256: null,
    evidence_schema_available: false, verification_available: false, message: "Synthetic only",
  }).success, true);
  assert.equal(screenshotAnalyzeResponseSchema.safeParse({
    mode: "manual", extraction: { ...extraction, amount_mmk: null, provider: null, transaction_reference: null, missing_fields: ["amount_mmk", "provider", "transaction_reference"] },
    candidates: [], duplicate_warnings: [], image_sha256: "a".repeat(64), evidence_schema_available: true,
    verification_available: true, message: "Manual review",
  }).success, true);
});

test("evidence save accepts only pending review or explicit rejection", () => {
  const input = {
    shop_id: "10000000-0000-4000-8000-000000000001",
    evidence_id: "20000000-0000-4000-8000-000000000002",
    order_id: null,
    status: "pending_review" as const,
    expected_revision: 0,
    extraction,
    seller_reviewed: extraction,
  };
  assert.equal(paymentEvidenceSaveSchema.safeParse(input).success, true);
  assert.equal(paymentEvidenceSaveSchema.safeParse({ ...input, status: "verified" }).success, false);
  assert.equal(paymentEvidenceSaveSchema.safeParse({ ...input, seller_reviewed: { ...extraction, extra: true } }).success, false);
});

test("evidence save payload preserves immutable extraction separately from seller corrections", () => {
  const corrected = { ...extraction, amount_mmk: 51000, provider: "WavePay" };
  const payload = buildPaymentEvidenceSavePayload({
    shopId: "10000000-0000-4000-8000-000000000001",
    evidenceId: "20000000-0000-4000-8000-000000000002",
    orderId: null,
    status: "pending_review",
    expectedRevision: 0,
    originalExtraction: extraction,
    sellerReviewed: corrected,
  });
  assert.deepEqual(payload.extraction, extraction);
  assert.deepEqual(payload.seller_reviewed, corrected);
  assert.notDeepEqual(payload.extraction, payload.seller_reviewed);
});

test("payment verification requires explicit trusted-record confirmation and validates readback", () => {
  const request = {
    shop_id: "10000000-0000-4000-8000-000000000001",
    evidence_id: "20000000-0000-4000-8000-000000000002",
    order_id: "30000000-0000-4000-8000-000000000003",
    amount_mmk: 52000,
    payment_method: "KBZPay",
    reference_number: "TX-123",
    expected_revision: 0,
    confirm_trusted_record: true as const,
  };
  assert.equal(paymentEvidenceVerifyRequestSchema.safeParse(request).success, true);
  assert.equal(paymentEvidenceVerifyRequestSchema.safeParse({ ...request, confirm_trusted_record: false }).success, false);
  assert.equal(paymentEvidenceVerifyRequestSchema.safeParse({ ...request, amount_mmk: 52000.5 }).success, false);
  assert.equal(paymentEvidenceVerifyReadbackSchema.safeParse({
    idempotent: false,
    evidence_id: request.evidence_id,
    payment: {
      id: "40000000-0000-4000-8000-000000000004", shop_id: request.shop_id, order_id: request.order_id,
      amount_mmk: 52000, payment_method: "KBZPay", reference_number: "TX-123",
      verified_at: "2026-10-21T12:00:00.000Z", created_at: "2026-10-21T12:00:00.000Z",
    },
    order: {
      id: request.order_id, order_status: "confirmed", payment_status: "paid", fulfillment_status: "unfulfilled",
      total_mmk: 52000, total_paid_mmk: 52000,
    },
  }).success, true);
});
