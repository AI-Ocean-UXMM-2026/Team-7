import assert from "node:assert/strict";
import test from "node:test";
import { canAddPaymentToOrder } from "./payment-review.ts";

test("requires a positive integer MMK amount and an order reference", () => {
  assert.equal(canAddPaymentToOrder("", ""), false);
  assert.equal(canAddPaymentToOrder("45000.50", "SS-1048"), false);
  assert.equal(canAddPaymentToOrder("0", "SS-1048"), false);
  assert.equal(canAddPaymentToOrder("45000", ""), false);
  assert.equal(canAddPaymentToOrder("45000", "SS-1048"), true);
});
