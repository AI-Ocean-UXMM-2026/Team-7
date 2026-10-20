import assert from "node:assert/strict";
import test from "node:test";
import {
  chatOrderExtractionSchema,
  chatOrderResponseSchema,
  expenseSchema,
  orderItemSchema,
  orderSchema,
  paymentStatusSchema,
  recoveryEmailSchema,
  resetPasswordSchema,
} from "./index.ts";

const ids = {
  shop: "10000000-0000-4000-8000-000000000001",
  order: "20000000-0000-4000-8000-000000000002",
  row: "30000000-0000-4000-8000-000000000003",
};
const now = "2026-10-20T00:00:00.000Z";

test("recovery validates email and password confirmation", () => {
  assert.equal(recoveryEmailSchema.parse({ email: " seller@example.com " }).email, "seller@example.com");
  assert.equal(recoveryEmailSchema.safeParse({ email: "invalid" }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ password: "long-enough", confirmation: "different" }).success, false);
  assert.equal(resetPasswordSchema.safeParse({ password: "long-enough", confirmation: "long-enough" }).success, true);
});

test("MMK order amounts require safe integers and keep payment status separate", () => {
  const valid = orderSchema.parse({
    id: ids.order,
    shop_id: ids.shop,
    customer_id: null,
    order_status: "confirmed",
    payment_status: "unpaid",
    fulfillment_status: "unfulfilled",
    subtotal_mmk: 25000,
    delivery_fee_mmk: 3000,
    discount_mmk: 0,
    total_mmk: 28000,
    delivery_address: null,
    notes: null,
    created_at: now,
    updated_at: now,
  });

  assert.equal(valid.order_status, "confirmed");
  assert.equal(valid.payment_status, "unpaid");
  assert.equal(paymentStatusSchema.parse("partially_paid"), "partially_paid");
  assert.equal(orderSchema.safeParse({ ...valid, total_mmk: 25000.5 }).success, false);
  assert.equal(orderSchema.safeParse({ ...valid, total_mmk: Number.MAX_SAFE_INTEGER + 1 }).success, false);
});

test("order item quantity and MMK price are constrained", () => {
  const item = {
    id: ids.row,
    shop_id: ids.shop,
    order_id: ids.order,
    product_name: "Mira tote bag",
    quantity: 2,
    unit_price_mmk: 45000,
    line_total_mmk: 90000,
    created_at: now,
  };

  assert.equal(orderItemSchema.parse(item).line_total_mmk, 90000);
  assert.equal(orderItemSchema.safeParse({ ...item, quantity: 0 }).success, false);
  assert.equal(orderItemSchema.safeParse({ ...item, unit_price_mmk: 12.5 }).success, false);
});

test("expense amount must be a positive integer MMK amount", () => {
  const expense = {
    id: ids.row,
    shop_id: ids.shop,
    description: "Packaging",
    amount_mmk: 1500,
    category: "supplies",
    expense_date: "2026-10-20",
    notes: null,
    created_at: now,
    updated_at: now,
  };

  assert.equal(expenseSchema.parse(expense).amount_mmk, 1500);
  assert.equal(expenseSchema.safeParse({ ...expense, amount_mmk: 0 }).success, false);
});

test("order saving validates totals, bounds, Burmese names, and rejects payment overrides", async () => {
  const { saveOrderSchema, calculateOrderTotals } = await import("./index.ts");
  const input = {
    shop_id: ids.shop, id: ids.order, expected_updated_at: null,
    customer_name: "မြမြ", customer_phone: null, delivery_address: null, notes: null,
    order_status: "confirmed", fulfillment_status: "unfulfilled",
    delivery_fee_mmk: 3000, discount_mmk: 1000,
    items: [{ product_name: "အိတ်", quantity: 2, unit_price_mmk: 25000 }],
  };
  assert.equal(saveOrderSchema.safeParse(input).success, true);
  assert.equal(saveOrderSchema.safeParse({ ...input, delivery_address: "14 Inya Road", customer_phone: null }).success, false);
  assert.equal(saveOrderSchema.safeParse({ ...input, delivery_address: "14 Inya Road", customer_phone: "09 777 222 111" }).success, true);
  assert.deepEqual(calculateOrderTotals(input.items, 3000, 1000), { subtotal_mmk: 50000, total_mmk: 52000 });
  assert.deepEqual(calculateOrderTotals([{ quantity: 3, unit_price_mmk: 25000 }], 3000, 1000), { subtotal_mmk: 75000, total_mmk: 77000 });
  for (const patch of [
    { payment_status: "paid" }, { total_mmk: 1 }, { items: [] }, { customer_name: " " },
    { discount_mmk: 53001 }, { delivery_fee_mmk: 1.5 },
    { items: [{ product_name: "Tote", quantity: 1000001, unit_price_mmk: 1 }] },
    { items: [{ product_name: "Tote", quantity: 1, unit_price_mmk: 9007199255 }] },
    { items: [{ product_name: "Tote", quantity: 0, unit_price_mmk: 1 }] },
    { items: [{ product_name: "Tote", quantity: 1.5, unit_price_mmk: 1 }] },
    { items: Array.from({ length: 101 }, () => input.items[0]) },
    { delivery_fee_mmk: Number.MAX_SAFE_INTEGER },
  ]) assert.equal(saveOrderSchema.safeParse({ ...input, ...patch }).success, false, JSON.stringify(patch));
  assert.throws(() => calculateOrderTotals(input.items, Number.MAX_SAFE_INTEGER, 0));
  assert.throws(() => calculateOrderTotals(input.items, 0, 50001));
  assert.equal(saveOrderSchema.safeParse({ ...input, items: [{ product_name: "Unknown price", quantity: 1, unit_price_mmk: NaN }] }).success, false);
});

test("chat extraction contracts preserve unknown fields and reject invented invalid values", () => {
  const extraction = {
    customer_name: "မြမြ",
    customer_phone: null,
    delivery_address: null,
    notes: null,
    delivery_fee_mmk: null,
    discount_mmk: null,
    items: [{ product_name: "အိတ်", quantity: 2, unit_price_mmk: 25000 }],
    missing_fields: ["delivery_address", "delivery_fee_mmk", "discount_mmk"],
  };
  assert.equal(chatOrderExtractionSchema.safeParse(extraction).success, true);
  assert.equal(chatOrderExtractionSchema.safeParse({ ...extraction, items: [{ ...extraction.items[0], quantity: 1.5 }] }).success, false);
  assert.equal(chatOrderResponseSchema.safeParse({ mode: "simulation", extraction, message: "Review" }).success, true);
  assert.equal(chatOrderResponseSchema.safeParse({ mode: "live", extraction, extra: true }).success, false);
});

test("chat extraction requests keep shop scope optional for local simulation but validate it when provided", async () => {
  const { chatOrderRequestSchema } = await import("./index.ts");
  assert.equal(chatOrderRequestSchema.safeParse({ chat: "hello" }).success, true);
  assert.equal(chatOrderRequestSchema.safeParse({ chat: "hello", shop_id: ids.shop }).success, true);
  assert.equal(chatOrderRequestSchema.safeParse({ chat: "hello", shop_id: "not-a-uuid" }).success, false);
});
