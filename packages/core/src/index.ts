export function calculateOrderTotals(items: { quantity: number; unit_price_mmk: number }[], delivery: number, discount: number) {
  if (!items.every(item => Number.isSafeInteger(item.quantity) && item.quantity > 0 && Number.isSafeInteger(item.unit_price_mmk) && item.unit_price_mmk >= 0)) {
    throw new Error("Use positive whole quantities and non-negative whole MMK prices.");
  }
  const subtotal_mmk = items.reduce((sum, item) => sum + item.quantity * item.unit_price_mmk, 0);
  const total_mmk = subtotal_mmk + delivery - discount;
  if (![subtotal_mmk, delivery, discount, subtotal_mmk + delivery, total_mmk].every(value => Number.isSafeInteger(value) && value >= 0)) {
    throw new Error("Use whole MMK amounts within the supported range; discount cannot exceed subtotal plus delivery.");
  }
  return { subtotal_mmk, total_mmk };
}

export type DateRange = { from: string; to: string };
export type FinancialOrder = { id: string; created_at: string; order_status: string; payment_status: string; total_mmk: number };
export type FinancialExpense = { id: string; expense_date: string; category: string; amount_mmk: number };
export type PaymentRecord = { id: string; order_id: string; received_on: string; amount_mmk: number; status: "confirmed" | "pending" };
export type FinancialData = {
  orders: FinancialOrder[]; expenses: FinancialExpense[];
  payments: PaymentRecord[] | null; productCosts: Record<string, number | null> | null;
};
export function myanmarDate(timestamp: string): string {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Yangon", year: "numeric", month: "2-digit", day: "2-digit" }).format(new Date(timestamp));
}
export function shiftDate(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}
export function validRange(range: DateRange): boolean {
  const valid = (date: string) => /^\d{4}-\d{2}-\d{2}$/.test(date) && Number.isFinite(Date.parse(`${date}T00:00:00Z`)) && new Date(`${date}T00:00:00Z`).toISOString().slice(0, 10) === date;
  return valid(range.from) && valid(range.to) && range.from <= range.to && (Date.parse(range.to) - Date.parse(range.from)) / 86400000 <= 366;
}
export function inRange(date: string, range: DateRange): boolean { return date >= range.from && date <= range.to; }
function safeSum(values: number[]): number {
  let result = 0;
  for (const value of values) {
    if (!Number.isSafeInteger(value) || value < 0) throw new Error("Amounts must be non-negative safe integer MMK.");
    result += value;
    if (!Number.isSafeInteger(result)) throw new Error("Financial total exceeds the supported MMK range.");
  }
  return result;
}
export function summarizeFinancials(data: FinancialData, range: DateRange) {
  if (!validRange(range)) throw new Error("Choose a valid date range of up to 367 days.");
  const orders = data.orders.filter(order => inRange(myanmarDate(order.created_at), range));
  const eligible = orders.filter(order => order.order_status === "confirmed");
  const expenses = data.expenses.filter(expense => inRange(expense.expense_date, range));
  const purchases = expenses.filter(expense => expense.category === "Product costs");
  const operating = expenses.filter(expense => expense.category !== "Product costs");
  const recordedSales = safeSum(eligible.map(order => order.total_mmk));
  const operatingExpenses = safeSum(operating.map(expense => expense.amount_mmk));
  const productPurchases = safeSum(purchases.map(expense => expense.amount_mmk));
  const costs = eligible.map(order => data.productCosts?.[order.id] ?? null);
  const productCosts = costs.some(value => value === null) ? null : safeSum(costs.filter(value => value !== null));
  const refundAdjustmentUnavailable = eligible.some(order => order.payment_status === "refunded");
  const confirmedPayments = data.payments === null ? null : safeSum(data.payments.filter(payment => payment.status === "confirmed" && inRange(payment.received_on, range)).map(payment => payment.amount_mmk));
  const pendingPayments = data.payments === null ? null : safeSum(data.payments.filter(payment => payment.status === "pending" && inRange(payment.received_on, range)).map(payment => payment.amount_mmk));
  const estimatedProfit = productCosts === null || refundAdjustmentUnavailable ? null : recordedSales - productCosts - operatingExpenses;
  if (estimatedProfit !== null && !Number.isSafeInteger(estimatedProfit)) throw new Error("Profit exceeds the supported MMK range.");
  return { recordedSales, confirmedPayments, pendingPayments, operatingExpenses, productPurchases, totalExpenses: safeSum(expenses.map(expense => expense.amount_mmk)), productCosts, estimatedProfit, totalOrders: orders.length, refundAdjustmentUnavailable };
}
export function financialTrend(data: FinancialData, range: DateRange) {
  if (!validRange(range)) throw new Error("Invalid date range.");
  const days = Math.round((Date.parse(range.to) - Date.parse(range.from)) / 86400000) + 1;
  const bucket = days > 62 ? 30 : days > 31 ? 7 : 1;
  const rows = [];
  for (let offset = 0; offset < days; offset += bucket) {
    const from = shiftDate(range.from, offset);
    const to = shiftDate(range.from, Math.min(offset + bucket - 1, days - 1));
    rows.push({ date: from, to, ...summarizeFinancials(data, { from, to }) });
  }
  return rows;
}
export function expenseBreakdown(expenses: FinancialExpense[], range: DateRange) {
  const categories = new Map<string, number[]>();
  for (const expense of expenses.filter(expense => inRange(expense.expense_date, range))) {
    categories.set(expense.category, [...(categories.get(expense.category) ?? []), expense.amount_mmk]);
  }
  return Array.from(categories, ([category, amounts]) => ({ category, amount_mmk: safeSum(amounts) })).sort((a, b) => b.amount_mmk - a.amount_mmk);
}
export function totalExpenseAmount(expenses: FinancialExpense[]): number { return safeSum(expenses.map(expense => expense.amount_mmk)); }

export { parseSimulatedChat } from "./chat-to-order.ts";
export type { ChatOrderExtraction, ChatOrderExtractionItem } from "./chat-to-order.ts";

export { duplicateWarnings, matchScreenshotOrders } from "./screenshot-match.ts";
export type {
  DuplicateWarning,
  ExistingPaymentEvidence,
  MatchableOrder,
  ScreenshotCandidate,
  ScreenshotEvidenceForMatch,
} from "./screenshot-match.ts";
