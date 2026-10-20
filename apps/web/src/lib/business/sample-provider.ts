import { calculateOrderTotals, expenseSchema, expenseInputSchema, orderDetailsSchema, shiftDate, type Expense, type ExpenseInput } from "@ocean/contracts";
import type { BusinessProvider, BusinessSnapshot } from "./types";

const shopId = "10000000-0000-4000-8000-000000000001";
const sampleExpenseKey = "salesayar:sample-expenses:v1";
const uuid = (n: number) => `${n.toString(16).padStart(8, "0")}-0000-4000-8000-${String(n).padStart(12, "0")}`;
// Explicit synthetic catalogue costs; never estimate real costs from selling prices.
const sampleProducts = [
  { name: "နေ့စဉ်သုံးအိတ် · Daily pouch", unit_price_mmk: 15000, unit_cost_mmk: 8000 },
  { name: "Everyday tote bag", unit_price_mmk: 25000, unit_cost_mmk: 14000 },
] as const;

export function createSampleSnapshot(today: string): BusinessSnapshot {
  const orders = Array.from({ length: 28 }, (_, index) => {
    const day = shiftDate(today, -index * 2);
    const status = index % 9 === 4 ? "draft" : index % 9 === 7 ? "cancelled" : "confirmed";
    const product = sampleProducts[index % 2]!;
    const items = [{ id: uuid(100 + index), shop_id: shopId, order_id: uuid(index + 1), product_name: product.name, quantity: index % 3 + 1, unit_price_mmk: product.unit_price_mmk, created_at: `${day}T03:00:00Z` }];
    return orderDetailsSchema.parse({
      id: uuid(index + 1), shop_id: shopId, customer_id: null,
      customers: { name: ["Thiri Mon", "မြမြ", "Nandar Hlaing", "Su Myat Noe"][index % 4], phone: null },
      order_status: status,
      payment_status: status === "confirmed" && index % 3 === 0 ? "paid" : "unpaid", fulfillment_status: status === "confirmed" && index % 3 === 0 ? "delivered" : "unfulfilled",
      ...calculateOrderTotals(items, 3000, index % 2 ? 1000 : 0), delivery_fee_mmk: 3000, discount_mmk: index % 2 ? 1000 : 0,
      delivery_address: null, notes: "Synthetic sample order. View only; never written to Supabase.", created_at: `${day}T03:00:00Z`, updated_at: `${day}T03:00:00Z`,
      order_items: items.map(item => ({ ...item, line_total_mmk: item.quantity * item.unit_price_mmk })),
    });
  });
  const expenses = Array.from({ length: 20 }, (_, index) => {
    const day = shiftDate(today, -index * 3);
    return expenseSchema.parse({ id: uuid(200 + index), shop_id: shopId,
      description: ["Packaging supplies", "Customer deliveries", "Shop promotion", "Product purchase", "ဆိုင်သုံးပစ္စည်း · Shop supplies"][index % 5],
      category: ["Packaging", "Delivery", "Marketing", "Product costs", "Other"][index % 5],
      amount_mmk: [18500, 12000, 25000, 142000, 7500][index % 5], expense_date: day, notes: "Sample expense", created_at: `${day}T02:00:00Z`, updated_at: `${day}T02:00:00Z` });
  });
  return { source: "sample", shopId, shopName: "May Thu’s Sample Shop", today, orders, expenses,
    payments: orders.filter(order => order.payment_status === "paid").map((order, index) => ({ id: uuid(300 + index), order_id: order.id, received_on: order.created_at.slice(0, 10), amount_mmk: order.total_mmk, status: "confirmed" })),
    productCosts: Object.fromEntries(orders.map((order, index) => [order.id, order.order_items.reduce((sum, item) => sum + item.quantity * sampleProducts[index % 2]!.unit_cost_mmk, 0)])),
    limitations: ["Sample expenses are stored only in this browser tab’s session. They never reach Supabase."] };
}
export function createSampleProvider(today: string): BusinessProvider {
  const base = createSampleSnapshot(today);
  function expenses(): Expense[] {
    const raw = sessionStorage.getItem(sampleExpenseKey);
    if (!raw) return base.expenses;
    const value: unknown = JSON.parse(raw);
    if (!Array.isArray(value)) throw new Error("Sample expenses could not be read. Reset the sample workspace to recover.");
    return value.map(row => {
      const parsed = expenseSchema.parse(row);
      if (parsed.shop_id !== shopId) throw new Error("Invalid sample shop. Reset the sample workspace.");
      return parsed;
    });
  }
  return { source: "sample", async load() { return { ...base, expenses: expenses() }; },
    async saveExpense(input: ExpenseInput, id?: string) {
      const parsed = expenseInputSchema.parse(input);
      const previous = expenses();
      const old = id ? previous.find(expense => expense.id === id) : undefined;
      if (id && !old) throw new Error("This sample expense no longer exists. Reload and try again.");
      const now = new Date().toISOString();
      const expense = expenseSchema.parse({ ...parsed, id: old?.id ?? crypto.randomUUID(), shop_id: shopId, created_at: old?.created_at ?? now, updated_at: now });
      sessionStorage.setItem(sampleExpenseKey, JSON.stringify([expense, ...previous.filter(row => row.id !== expense.id)]));
      return expense;
    },
  };
}
export function resetSampleExpenses() { sessionStorage.removeItem(sampleExpenseKey); }
