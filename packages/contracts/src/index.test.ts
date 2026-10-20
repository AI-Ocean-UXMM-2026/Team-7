import assert from "node:assert/strict";
import test from "node:test";
import {
  expenseSchema,
  orderItemSchema,
  orderSchema,
  paymentStatusSchema,
} from "./index.ts";

const ids = {
  shop: "10000000-0000-4000-8000-000000000001",
  order: "20000000-0000-4000-8000-000000000002",
  row: "30000000-0000-4000-8000-000000000003",
};
const now = "2026-10-20T00:00:00.000Z";

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
