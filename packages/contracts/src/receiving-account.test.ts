import assert from "node:assert/strict";
import test from "node:test";
import { receivingAccountInputSchema } from "./receiving-account.ts";

const valid = { shop_id: "10000000-0000-4000-8000-000000000001", provider: "AYA Pay", account_name: "Yoon Yati Linn", account_number: "09757109900" };

test("receiving account input requires a bounded named payment destination", () => {
  assert.equal(receivingAccountInputSchema.safeParse(valid).success, true);
  assert.equal(receivingAccountInputSchema.safeParse({ ...valid, account_number: "****9900" }).success, false);
  assert.equal(receivingAccountInputSchema.safeParse({ ...valid, shop_id: "other-shop" }).success, false);
  assert.equal(receivingAccountInputSchema.safeParse({ ...valid, account_name: "" }).success, false);
});
