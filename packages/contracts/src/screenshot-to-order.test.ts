import assert from "node:assert/strict";
import test from "node:test";
import {
  buildPaymentEvidenceSavePayload,
  paymentEvidenceSaveSchema,
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
  payee_name: "SaleSayar",
  missing_fields: [],
  uncertain_fields: [],
};

test("screenshot contracts keep missing values nullable and payment statuses bounded", () => {
  assert.equal(screenshotMimeSchema.safeParse("image/gif").success, false);
  assert.equal(screenshotExtractionSchema.safeParse({ ...extraction, amount_mmk: null, transaction_reference: null }).success, true);
  assert.equal(screenshotExtractionSchema.safeParse({ ...extraction, amount_mmk: 1.5 }).success, false);
  assert.equal(screenshotAnalyzeResponseSchema.safeParse({
    mode: "simulation", extraction, candidates: [], duplicate_warnings: [], image_sha256: null,
    evidence_schema_available: false, message: "Synthetic only",
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
