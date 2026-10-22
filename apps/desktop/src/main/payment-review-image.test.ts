import assert from "node:assert/strict";
import test from "node:test";
import { paymentReviewImageSchema } from "./payment-review-image.ts";

test("payment review handoff accepts only bounded local image data", () => {
  assert.equal(paymentReviewImageSchema.safeParse("data:image/png;base64,iVBORw0KGgo=").success, true);
  assert.equal(paymentReviewImageSchema.safeParse("https://example.com/receipt.png").success, false);
  assert.equal(paymentReviewImageSchema.safeParse("data:text/html;base64,PGgxPg==").success, false);
  assert.equal(paymentReviewImageSchema.safeParse(`data:image/png;base64,${"A".repeat(12_000_001)}`).success, false);
});
