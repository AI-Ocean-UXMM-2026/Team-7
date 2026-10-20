import assert from "node:assert/strict";
import test from "node:test";
import { summarizeFinancials, financialTrend, expenseBreakdown, myanmarDate, validRange, type FinancialData } from "./index.ts";
const range = { from: "2026-10-01", to: "2026-10-31" };
function fixture(): FinancialData {
  return {
    orders: [
      { id: "a", created_at: "2026-10-20T03:00:00Z", order_status: "confirmed", payment_status: "unpaid", total_mmk: 52000 },
      { id: "b", created_at: "2026-10-20T03:00:00Z", order_status: "draft", payment_status: "unpaid", total_mmk: 100000 },
      { id: "c", created_at: "2026-10-20T03:00:00Z", order_status: "cancelled", payment_status: "unpaid", total_mmk: 100000 },
    ],
    expenses: [{ id: "e", expense_date: "2026-10-20", category: "Packaging", amount_mmk: 2000 }, { id: "p", expense_date: "2026-10-20", category: "Product costs", amount_mmk: 30000 }],
    payments: [{ id: "r", order_id: "a", received_on: "2026-10-21", amount_mmk: 10000, status: "confirmed" }, { id: "pending", order_id: "a", received_on: "2026-10-20", amount_mmk: 42000, status: "pending" }],
    productCosts: { a: 28000 },
  };
}
test("sales, actual receipts and profit are distinct; inventory purchases are not counted twice", () => {
  const result = summarizeFinancials(fixture(), range);
  assert.equal(result.recordedSales, 52000);
  assert.equal(result.confirmedPayments, 10000);
  assert.equal(result.pendingPayments, 42000);
  assert.equal(result.estimatedProfit, 22000);
  assert.equal(result.operatingExpenses, 2000);
  assert.equal(result.productPurchases, 30000);
  assert.equal(result.totalExpenses, 32000);
  assert.equal(result.totalOrders, 3);
});
test("unknown costs and unconnected payment records stay unavailable; loss is allowed", () => {
  const data = fixture(); data.payments = null; data.productCosts = null;
  assert.equal(summarizeFinancials(data, range).confirmedPayments, null);
  assert.equal(summarizeFinancials(data, range).estimatedProfit, null);
  data.productCosts = { a: 60000 };
  assert.equal(summarizeFinancials(data, range).estimatedProfit, -10000);
  data.productCosts = { a: 0 };
  assert.equal(summarizeFinancials(data, range).estimatedProfit, 50000);
});
test("payment dates and Myanmar midnight are respected", () => {
  assert.equal(myanmarDate("2026-10-19T18:00:00Z"), "2026-10-20");
  const data = fixture();
  assert.equal(summarizeFinancials(data, { from: "2026-10-20", to: "2026-10-20" }).confirmedPayments, 0);
  assert.equal(summarizeFinancials(data, { from: "2026-10-21", to: "2026-10-21" }).confirmedPayments, 10000);
});
test("refund adjustments are not invented and refund-dependent profit is unavailable", () => {
  const data = fixture(); data.orders[0]!.payment_status = "refunded";
  const result = summarizeFinancials(data, range);
  assert.equal(result.refundAdjustmentUnavailable, true);
  assert.equal(result.recordedSales, 52000); // explicitly before refunds
  assert.equal(result.estimatedProfit, null);
});
test("trend aggregation and expense categories reconcile to the selected period", () => {
  const data = fixture();
  const rows = financialTrend(data, range);
  assert.equal(rows.reduce((sum, row) => sum + row.recordedSales, 0), 52000);
  assert.equal(rows.reduce((sum, row) => sum + (row.confirmedPayments ?? 0), 0), 10000);
  assert.deepEqual(expenseBreakdown(data.expenses, range), [{ category: "Product costs", amount_mmk: 30000 }, { category: "Packaging", amount_mmk: 2000 }]);
  assert.equal(summarizeFinancials(data, { from: "2025-01-01", to: "2025-01-31" }).recordedSales, 0);
});
test("invalid ranges, fractional money and unsafe totals fail explicitly", () => {
  assert.equal(validRange({ from: "2026-02-30", to: "2026-03-01" }), false);
  assert.equal(validRange({ from: "2026-10-02", to: "2026-10-01" }), false);
  assert.equal(validRange({ from: "2020-01-01", to: "2026-01-01" }), false);
  const data = fixture(); data.orders[0]!.total_mmk = 1.5;
  assert.throws(() => summarizeFinancials(data, range));
  data.orders[0]!.total_mmk = Number.MAX_SAFE_INTEGER;
  data.orders.push({ ...data.orders[0]!, id: "overflow", total_mmk: 1 });
  assert.throws(() => summarizeFinancials(data, range));
});
