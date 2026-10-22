import assert from "node:assert/strict";
import test from "node:test";
import { compareReceiptRecipient } from "./receipt-recipient.ts";

const accounts = [{ provider: "KBZPay", account_name: "Yoon Yati Linn", last_four: "9900" }, { provider: "AYA Pay", account_name: "Yoon Yati Linn", last_four: "4086" }];
test("compares different receipt providers against multiple shop accounts", () => {
  assert.equal(compareReceiptRecipient({ provider: "KPay", payee_name: "YOON YATI LINN", payee_account: "******9900" }, accounts).state, "consistent");
  assert.equal(compareReceiptRecipient({ provider: "AYA Pay", payee_name: "Yoon Yati Linn", payee_account: "09757109900" }, accounts).state, "recipient_mismatch");
  assert.equal(compareReceiptRecipient({ provider: "WavePay", payee_name: "Yoon Yati Linn", payee_account: null }, accounts).state, "provider_mismatch");
});
test("missing recipient details never become a fraud verdict", () => {
  assert.equal(compareReceiptRecipient({ provider: "KPay", payee_name: null, payee_account: null }, accounts).state, "unavailable");
  assert.equal(compareReceiptRecipient({ provider: "KPay", payee_name: null, payee_account: null }, []).state, "not_configured");
});
