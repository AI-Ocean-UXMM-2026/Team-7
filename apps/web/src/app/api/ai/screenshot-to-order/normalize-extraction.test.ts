import assert from "node:assert/strict";
import test from "node:test";
import { normalizeVisionExtraction } from "./normalize-extraction.ts";

test("accepts visibly read fields when provider omits review metadata", () => {
  const result = normalizeVisionExtraction({
    amount_mmk: "-100,000.00 Ks",
    provider: "KBZPay",
    transaction_reference: "01004258000019785320",
    transaction_date: "2026-08-29",
    transaction_time: "11:23:40",
    payee_name: "Yoon Yati Linn",
  });
  assert.equal(result?.amount_mmk, 100000);
  assert.equal(result?.transaction_reference, "01004258000019785320");
  assert.equal(result?.payee_name, "Yoon Yati Linn");
  assert.equal(result?.payer_name, null);
  assert.ok(result?.missing_fields.includes("payer_name"));
});

test("does not accept unreadable amounts or invented dates", () => {
  const result = normalizeVisionExtraction({ amount_mmk: "around 100,000", transaction_date: "unreadable date", payee_name: "Yoon Yati Linn" });
  assert.equal(result?.amount_mmk, null);
  assert.equal(result?.transaction_date, null);
  assert.equal(normalizeVisionExtraction({ amount_mmk: "around 100,000" }), null);
});

test("keeps partial receipt details for seller review", () => {
  const result = normalizeVisionExtraction({ provider: "WavePay", transaction_date: "2026-08-29" });
  assert.equal(result?.provider, "WavePay");
  assert.equal(result?.transaction_date, "2026-08-29");
  assert.equal(result?.amount_mmk, null);
  assert.ok(result?.missing_fields.includes("amount_mmk"));
});
