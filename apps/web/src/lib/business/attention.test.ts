import assert from "node:assert/strict";
import test from "node:test";
import { getDashboardAttention } from "./attention.ts";
import { createSampleSnapshot } from "./sample-provider.ts";

test("dashboard attention prioritizes reviewable order states", () => {
  const data = createSampleSnapshot("2026-10-20");
  const items = getDashboardAttention(data, data.orders);

  assert.deepEqual(
    items.slice(0, 3).map((item) => item.id),
    ["draft-orders", "unpaid-orders", "unfulfilled-orders"],
  );
  assert.ok(items[0]?.orderId);
  assert.match(items[0]?.detail ?? "", /orders? still need seller review/);
});

test("dashboard attention labels missing live sources instead of guessing", () => {
  const data = createSampleSnapshot("2026-10-20");
  const items = getDashboardAttention(
    { payments: null, productCosts: null },
    data.orders.filter((order) => order.order_status === "cancelled"),
  );

  assert.deepEqual(items.map((item) => item.id), ["missing-payments", "missing-costs"]);
  assert.match(items[0]?.detail ?? "", /confirmed payment records/);
  assert.match(items[1]?.detail ?? "", /no profit number is guessed/);
});
